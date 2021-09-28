import {
  JSDoc,
  ModuleDeclaration,
  ModuleDeclarationKind,
  ModuledNode,
  Node,
  PropertySignature,
  SourceFile,
  StringLiteral,
  ts,
} from "ts-morph";
import { collectSymbol, getProject, getRootSymbolName } from ".";
import {
  ClassMember,
  SerializedDeclaration,
  SerializedType,
} from "../lib/types";
import { convertTypeNode } from "./convert-node";
import { convertType } from "./convert-type";
import {
  getDocs,
  getSymbolIdentifier,
  getDocsFromJSDocNodes,
  getDocsFromCompilerNode,
  getTypeParametersFromCompilerNode,
  getParametersFromCompilerNode,
  getObjectMembersFromCompilerNode,
} from "./utils";
import { assert } from "../lib/assert";

function getReturnType(node: ts.SignatureDeclaration): SerializedType {
  if (node.type) {
    return convertTypeNode(node.type);
  }
  const signature = getProject()
    .getTypeChecker()
    .compilerObject.getSignatureFromDeclaration(node);
  assert(
    signature !== undefined,
    "expected to always get signature from signature declaration"
  );
  const returnType = signature.getReturnType();
  return convertType(returnType);
}

export function convertDeclaration(
  decl: Node,
  symbol: ts.Symbol
): SerializedDeclaration {
  const compilerNode = decl.compilerNode;
  if (ts.isTypeAliasDeclaration(compilerNode)) {
    return {
      kind: "type-alias",
      name: compilerNode.name.text,
      docs: getDocsFromCompilerNode(compilerNode),
      typeParams: getTypeParametersFromCompilerNode(compilerNode),
      type: convertTypeNode(compilerNode.type),
    };
  }

  if (ts.isFunctionDeclaration(compilerNode)) {
    return {
      kind: "function",
      // the only case where a function declaration doesn't have a name is when it's a default export
      // (yes, function expressions never have to have names but this is a function declaration, not a function expression)
      name: compilerNode.name?.text || "default",
      parameters: getParametersFromCompilerNode(compilerNode),
      docs: getDocsFromCompilerNode(compilerNode),
      typeParams: getTypeParametersFromCompilerNode(compilerNode),
      returnType: getReturnType(compilerNode),
    };
  }
  if (
    decl instanceof SourceFile ||
    (decl instanceof ModuleDeclaration &&
      decl.getDeclarationKind() === ModuleDeclarationKind.Module)
  ) {
    let jsDocs = getJsDocsFromSourceFile(decl);

    // if you have a file that re-exports _everything_ from somewhere else
    // then look at that place for jsdocs since e.g. Preconstruct
    // generates a declaration file that re-exports from the actual place that might include a JSDoc comment
    if (jsDocs.length === 0) {
      let foundStar = false;
      let sourceFile: undefined | SourceFile = undefined;
      for (const exportDecl of decl.getExportDeclarations()) {
        const file = exportDecl.getModuleSpecifierSourceFile();
        if (!file || (sourceFile && file !== sourceFile)) {
          sourceFile = undefined;
          break;
        }
        sourceFile = file;
        if (exportDecl.getNodeProperty("exportClause") === undefined) {
          foundStar = true;
        }
      }
      if (foundStar && sourceFile) {
        jsDocs = getJsDocsFromSourceFile(sourceFile);
      }
    }

    return {
      kind: "module",
      name:
        getRootSymbolName(decl.getSymbolOrThrow()) ||
        (decl instanceof ModuleDeclaration
          ? (decl.getNameNodes() as StringLiteral).getLiteralValue()
          : decl.getFilePath()),
      docs: getDocsFromJSDocNodes(jsDocs.map((x) => x.compilerNode)),
      exports: collectExportsFromModule(decl),
    };
  }
  if (ts.isVariableDeclaration(compilerNode)) {
    const variableStatement = compilerNode.parent.parent;
    assert(
      ts.isVariableStatement(variableStatement),
      "expected to only get variable declarations as part of a variable statement"
    );

    const docs =
      variableStatement.declarationList.declarations.indexOf(compilerNode) === 1
        ? (
            getDocsFromCompilerNode(variableStatement) +
            "\n\n" +
            getDocsFromCompilerNode(compilerNode)
          ).trim()
        : getDocsFromCompilerNode(compilerNode);

    assert(
      ts.isIdentifier(compilerNode.name),
      "expected name of variable declaration to be an identifier when serializing from declaration of symbol"
    );

    if (
      !compilerNode.type &&
      compilerNode.initializer &&
      ts.isArrowFunction(compilerNode.initializer)
    ) {
      return {
        kind: "function",
        name: compilerNode.name.text,
        parameters: getParametersFromCompilerNode(compilerNode.initializer),
        docs,
        typeParams: getTypeParametersFromCompilerNode(compilerNode.initializer),
        returnType: getReturnType(compilerNode.initializer),
      };
    }
    return {
      kind: "variable",
      name: compilerNode.name.text,
      docs,
      variableKind:
        variableStatement.declarationList.flags & ts.NodeFlags.Const
          ? "const"
          : variableStatement.declarationList.flags & ts.NodeFlags.Let
          ? "let"
          : "var",
      type: compilerNode.type
        ? convertTypeNode(compilerNode.type)
        : convertType(
            getProject()
              .getTypeChecker()
              .compilerObject.getTypeAtLocation(compilerNode)
          ),
    };
  }
  if (decl instanceof PropertySignature) {
    const typeNode = decl.getTypeNode();
    return {
      kind: "variable",
      name: decl.getName(),
      docs: getDocs(decl),
      variableKind: "const",
      type: typeNode ? convertTypeNode(typeNode) : convertType(decl.getType()),
    };
  }
  if (ts.isInterfaceDeclaration(compilerNode)) {
    return {
      kind: "interface",
      name: compilerNode.name.text,
      docs: getDocsFromCompilerNode(compilerNode),
      typeParams: getTypeParametersFromCompilerNode(compilerNode),
      extends: (compilerNode.heritageClauses || []).flatMap((x) => {
        assert(
          x.token === ts.SyntaxKind.ExtendsKeyword,
          "expected interface declaration to only have extends and never implements"
        );
        return x.types.map((x) => convertTypeNode(x));
      }),
      members: getObjectMembersFromCompilerNode(compilerNode),
    };
  }
  if (ts.isClassDeclaration(compilerNode)) {
    const extendsNode = compilerNode.heritageClauses?.find(
      (x) => x.token === ts.SyntaxKind.ExtendsKeyword
    );
    if (extendsNode) {
      assert(
        extendsNode.types.length === 1,
        "expected extends clause in class declaration to only have one type"
      );
    }
    const implementsNode = compilerNode.heritageClauses?.find(
      (x) => x.token === ts.SyntaxKind.ImplementsKeyword
    );
    return {
      kind: "class",
      // just like function declarations, the only case where a class declaration doesn't have a name is when it's a default export
      // (yes, class expressions never have to have names but this is a class declaration, not a class expression)
      name: compilerNode.name?.text || "default",
      docs: getDocsFromCompilerNode(compilerNode),
      typeParams: getTypeParametersFromCompilerNode(compilerNode),
      extends: extendsNode ? convertTypeNode(extendsNode.types[0]) : null,
      implements: (implementsNode?.types || []).map((x) => convertTypeNode(x)),
      willBeComparedNominally: compilerNode.members.some((member) => {
        member.modifiers?.some(
          (x) =>
            x.kind === ts.SyntaxKind.PrivateKeyword ||
            x.kind === ts.SyntaxKind.ProtectedKeyword
        ) ||
          (member.name && ts.isPrivateIdentifier(member.name));
      }),
      constructors: compilerNode.members.flatMap((x) => {
        if (!ts.isConstructorDeclaration(x)) {
          return [];
        }
        return [
          {
            docs: getDocsFromCompilerNode(x),
            parameters: getParametersFromCompilerNode(x),
            typeParams: getTypeParametersFromCompilerNode(x),
          },
        ];
      }),
      members: compilerNode.members
        .filter(
          (member) =>
            !(
              ts.isConstructorDeclaration(member) ||
              ts.isClassStaticBlockDeclaration(member) ||
              member.modifiers?.some(
                (x) => x.kind === ts.SyntaxKind.PrivateKeyword
              ) ||
              (member.name && ts.isPrivateIdentifier(member.name)) ||
              ts.isSemicolonClassElement(member)
            )
        )
        .map((member): ClassMember => {
          const isStatic =
            member.modifiers?.some(
              (x) => x.kind === ts.SyntaxKind.StaticKeyword
            ) || false;
          if (ts.isMethodDeclaration(member)) {
            // TODO: show protected
            // (and have a tooltip explaining what protected does)
            return {
              kind: "method",
              docs: getDocsFromCompilerNode(member),
              name: printPropertyName(member.name),
              static: isStatic,
              optional: !!member.questionToken,
              parameters: getParametersFromCompilerNode(member),
              returnType: getReturnType(member),
              typeParams: getTypeParametersFromCompilerNode(member),
            };
          }
          if (ts.isPropertyDeclaration(member)) {
            return {
              kind: "prop",
              docs: getDocsFromCompilerNode(member),
              name: printPropertyName(member.name),
              optional: !!member.questionToken,
              type: member.type
                ? convertTypeNode(member.type)
                : convertType(
                    getProject()
                      .getTypeChecker()
                      .compilerObject.getTypeAtLocation(member)
                  ),
              static: isStatic,
              readonly:
                member.modifiers?.some(
                  (x) => x.kind === ts.SyntaxKind.ReadonlyKeyword
                ) || false,
            };
          }
          return { kind: "unknown", content: member.getText() };
        }),
    };
  }
  if (ts.isEnumDeclaration(compilerNode)) {
    return {
      kind: "enum",
      const: !!compilerNode.modifiers?.some(
        (x) => x.kind === ts.SyntaxKind.ConstKeyword
      ),
      name: compilerNode.name.text,
      docs: getDocsFromCompilerNode(compilerNode),
      members: compilerNode.members.map((member) => {
        const symbol = getProject()
          .getTypeChecker()
          .compilerObject.getSymbolAtLocation(member.name);
        assert(symbol !== undefined, "expected enum member to have symbol");
        collectSymbol(symbol);
        return getSymbolIdentifier(symbol);
      }),
    };
  }
  if (ts.isEnumMember(compilerNode)) {
    return {
      kind: "enum-member",
      name: ts.isIdentifier(compilerNode.name)
        ? compilerNode.name.text
        : compilerNode.name.getText(),
      docs: getDocsFromCompilerNode(compilerNode),
      value:
        getProject()
          .getTypeChecker()
          .compilerObject.getConstantValue(compilerNode) ?? null,
    };
  }
  if (
    decl instanceof ModuleDeclaration &&
    decl.getDeclarationKind() === ModuleDeclarationKind.Namespace
  ) {
    return {
      kind: "namespace",
      name: decl.getName(),
      docs: getDocs(decl),
      exports: collectExportsFromModule(decl),
    };
  }
  let docs = Node.isJSDocableNode(decl) ? getDocs(decl) : "";
  console.log(symbol.getName(), decl.getKindName());
  return {
    kind: "unknown",
    name: symbol.getName(),
    docs,
    content: decl.getText(),
  };
}

function printPropertyName(propertyName: ts.PropertyName) {
  if (
    ts.isIdentifier(propertyName) ||
    ts.isPrivateIdentifier(propertyName) ||
    ts.isNumericLiteral(propertyName)
  ) {
    return propertyName.text;
  }
  if (ts.isStringLiteral(propertyName)) {
    return JSON.stringify(propertyName.text);
  }
  return propertyName.getText();
}

function collectExportsFromModule(moduledDecl: ModuledNode) {
  let exports: Record<string, string | 0> = {};
  for (const [
    exportName,
    exportedDeclarations,
  ] of moduledDecl.getExportedDeclarations()) {
    const decl = exportedDeclarations[0];
    if (!decl) {
      console.log(
        `no declarations for export ${exportName} in ${
          moduledDecl instanceof SourceFile
            ? moduledDecl.getFilePath()
            : moduledDecl instanceof ModuleDeclaration
            ? moduledDecl.getName()
            : "unknown"
        }`
      );
      exports[exportName] = 0;
      continue;
    }
    let innerSymbol = decl.getSymbolOrThrow();
    innerSymbol = innerSymbol.getAliasedSymbol() || innerSymbol;
    collectSymbol(innerSymbol);
    exports[exportName] = getSymbolIdentifier(innerSymbol);
  }
  return exports;
}

function getJsDocsFromSourceFile(decl: Node) {
  const jsDocs: JSDoc[] = [];
  decl.forEachChild((node) => {
    if (!!(node.compilerNode as any).jsDoc) {
      const nodes: ts.JSDoc[] = (node.compilerNode as any).jsDoc ?? [];
      const jsdocs: JSDoc[] = nodes.map((n) =>
        (node as any)._getNodeFromCompilerNode(n)
      );
      for (const doc of jsdocs) {
        if (doc.getTags().some((tag) => tag.getTagName() === "module")) {
          jsDocs.push(doc);
        }
      }
    }
  });
  return jsDocs;
}
