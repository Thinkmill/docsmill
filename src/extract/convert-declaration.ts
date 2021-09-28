import {
  ArrowFunction,
  ClassDeclaration,
  ClassStaticBlockDeclaration,
  ConstructorDeclaration,
  JSDoc,
  MethodDeclaration,
  ModuleDeclaration,
  ModuleDeclarationKind,
  ModuledNode,
  Node,
  PrivateIdentifier,
  PropertyDeclaration,
  PropertySignature,
  SourceFile,
  StringLiteral,
  ts,
  VariableDeclaration,
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
  getTypeParameters,
  getParameters,
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

export function convertDeclaration(decl: Node): SerializedDeclaration {
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
  if (decl instanceof VariableDeclaration) {
    const typeNode = decl.getTypeNode();
    const init = decl.getInitializer();
    const variableStatement = decl.getVariableStatementOrThrow();

    if (!typeNode && init instanceof ArrowFunction) {
      const returnTypeNode = init.getReturnTypeNode();
      return {
        kind: "function",
        name: decl.getName(),
        parameters: getParameters(init),
        docs: getDocs(variableStatement),
        typeParams: getTypeParameters(init),
        returnType: returnTypeNode
          ? convertTypeNode(returnTypeNode)
          : convertType(init.getReturnType()),
      };
    }
    return {
      kind: "variable",
      name: decl.getName(),
      docs: getDocs(variableStatement),
      variableKind: variableStatement.getDeclarationKind(),
      type: typeNode ? convertTypeNode(typeNode) : convertType(decl.getType()),
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
  if (decl instanceof ClassDeclaration) {
    const extendsNode = decl.getExtends();
    return {
      kind: "class",
      // just like function declarations, the only case where a class declaration doesn't have a name is when it's a default export
      // (yes, class expressions never have to have names but this is a class declaration, not a class expression)
      name: decl.getName() || "default",
      docs: getDocs(decl),
      typeParams: getTypeParameters(decl),
      extends: extendsNode ? convertTypeNode(extendsNode) : null,
      implements: decl.getImplements().map((x) => convertTypeNode(x)),
      willBeComparedNominally: decl
        .getMembers()
        .some((member) =>
          member instanceof ClassStaticBlockDeclaration
            ? false
            : member.hasModifier("private") ||
              member.hasModifier("protected") ||
              (!(member instanceof ConstructorDeclaration) &&
                member.getNameNode() instanceof PrivateIdentifier)
        ),
      constructors: decl.getConstructors().map((x) => {
        return {
          docs: getDocs(x),
          parameters: getParameters(x),
          typeParams: getTypeParameters(x),
        };
      }),
      members: decl.getMembers().flatMap((member): ClassMember[] => {
        if (
          member instanceof ConstructorDeclaration ||
          member instanceof ClassStaticBlockDeclaration ||
          member.hasModifier("private")
        ) {
          return [];
        }
        if (member.getNameNode() instanceof PrivateIdentifier) {
          return [];
        }
        if (member instanceof MethodDeclaration) {
          // TODO: show protected
          // (and have a tooltip explaining what protected does)

          return [
            ...member.getOverloads(),
            ...(member.isOverload() ? [] : [member]),
          ].map((member) => {
            const returnTypeNode = member.getReturnTypeNode();
            return {
              kind: "method",
              docs: getDocs(member),
              name: member.getName(),
              static: member.isStatic(),
              optional: member.hasQuestionToken(),
              parameters: getParameters(member),
              returnType: returnTypeNode
                ? convertTypeNode(returnTypeNode)
                : convertType(member.getReturnType()),
              typeParams: getTypeParameters(member),
            };
          });
        }
        if (member instanceof PropertyDeclaration) {
          const typeNode = member.getTypeNode();

          return [
            {
              kind: "prop",
              docs: getDocs(member),
              name: member.getName(),
              optional: member.hasQuestionToken(),
              type: typeNode
                ? convertTypeNode(typeNode)
                : convertType(member.getType()),
              static: member.isStatic(),
              readonly: member.isReadonly(),
            },
          ];
        }
        return [{ kind: "unknown", content: member.getText() }];
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
  let symbol = decl.getSymbolOrThrow();
  console.log(symbol.getName(), decl.getKindName());
  return {
    kind: "unknown",
    name: symbol.getName(),
    docs,
    content: decl.getText(),
  };
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
