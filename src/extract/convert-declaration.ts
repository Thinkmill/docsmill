import { ts } from "./ts";
import { collectSymbol, getRootSymbolName, getTypeChecker } from ".";
import { ClassMember, SerializedDeclaration, SymbolId } from "../lib/types";
import { convertTypeNode } from "./convert-node";
import { convertType } from "./convert-type";
import {
  getSymbolIdentifier,
  getDocsFromJSDocNodes,
  getDocs,
  getTypeParameters,
  getParameters,
  getObjectMembers,
  getAliasedSymbol,
  getSymbolAtLocation,
  getReturnType,
} from "./utils";
import { assert } from "../lib/assert";
import { getExportedDeclarations } from "./get-exported-declarations";

export function convertDeclaration(
  compilerNode: ts.Node
): SerializedDeclaration {
  if (ts.isTypeAliasDeclaration(compilerNode)) {
    return {
      kind: "type-alias",
      name: compilerNode.name.text,
      docs: getDocs(compilerNode),
      typeParams: getTypeParameters(compilerNode),
      type: convertTypeNode(compilerNode.type),
    };
  }

  if (ts.isFunctionDeclaration(compilerNode)) {
    return {
      kind: "function",
      // the only case where a function declaration doesn't have a name is when it's a default export
      // (yes, function expressions never have to have names but this is a function declaration, not a function expression)
      name: compilerNode.name?.text || "default",
      parameters: getParameters(compilerNode),
      docs: getDocs(compilerNode),
      typeParams: getTypeParameters(compilerNode),
      returnType: getReturnType(compilerNode),
    };
  }
  if (
    ts.isSourceFile(compilerNode) ||
    (ts.isModuleDeclaration(compilerNode) &&
      ts.isStringLiteral(compilerNode.name))
  ) {
    let jsDocs = getJsDocsFromSourceFile(compilerNode);

    // if you have a file that re-exports _everything_ from somewhere else
    // then look at that place for jsdocs since e.g. Preconstruct
    // generates a declaration file that re-exports from the actual place that might include a JSDoc comment
    if (jsDocs.length === 0 && ts.isSourceFile(compilerNode)) {
      let foundStar = false;
      let sourceFile: undefined | ts.SourceFile = undefined;

      for (const exportDecl of compilerNode.statements) {
        if (
          exportDecl.modifiers?.some(
            (x) => x.kind === ts.SyntaxKind.ExportKeyword
          )
        ) {
          sourceFile = undefined;
          break;
        }
        if (!ts.isExportDeclaration(exportDecl)) {
          continue;
        }

        const file =
          exportDecl.moduleSpecifier &&
          ts.isStringLiteral(exportDecl.moduleSpecifier)
            ? getSymbolAtLocation(exportDecl.moduleSpecifier)?.valueDeclaration
            : undefined;

        if (
          !file ||
          !ts.isSourceFile(file) ||
          (sourceFile && file !== sourceFile)
        ) {
          sourceFile = undefined;
          break;
        }
        sourceFile = file;
        if (exportDecl.exportClause === undefined) {
          foundStar = true;
        }
      }
      if (foundStar && sourceFile) {
        jsDocs = getJsDocsFromSourceFile(sourceFile);
      }
    }

    const symbol = getSymbolAtLocation(compilerNode);

    assert(symbol !== undefined, "expected symbol to exist");

    return {
      kind: "module",
      name:
        getRootSymbolName(symbol) ||
        (ts.isModuleDeclaration(compilerNode)
          ? (compilerNode.name as ts.StringLiteral).text
          : compilerNode.fileName),
      docs: getDocsFromJSDocNodes(jsDocs),
      exports: collectExportsFromModule(symbol),
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
        ? (getDocs(variableStatement) + "\n\n" + getDocs(compilerNode)).trim()
        : getDocs(compilerNode);

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
        parameters: getParameters(compilerNode.initializer),
        docs,
        typeParams: getTypeParameters(compilerNode.initializer),
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
        : convertType(getTypeChecker().getTypeAtLocation(compilerNode)),
    };
  }
  if (ts.isPropertySignature(compilerNode)) {
    return {
      kind: "variable",
      name: printPropertyName(compilerNode.name),
      docs: getDocs(compilerNode),
      variableKind: "const",
      type: compilerNode.type
        ? convertTypeNode(compilerNode.type)
        : convertType(getTypeChecker().getTypeAtLocation(compilerNode)),
    };
  }
  if (ts.isInterfaceDeclaration(compilerNode)) {
    return {
      kind: "interface",
      name: compilerNode.name.text,
      docs: getDocs(compilerNode),
      typeParams: getTypeParameters(compilerNode),
      extends: (compilerNode.heritageClauses || []).flatMap((x) => {
        assert(
          x.token === ts.SyntaxKind.ExtendsKeyword,
          "expected interface declaration to only have extends and never implements"
        );
        return x.types.map((x) => convertTypeNode(x));
      }),
      members: getObjectMembers(compilerNode),
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
      docs: getDocs(compilerNode),
      typeParams: getTypeParameters(compilerNode),
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
            docs: getDocs(x),
            parameters: getParameters(x),
            typeParams: getTypeParameters(x),
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
              docs: getDocs(member),
              name: printPropertyName(member.name),
              static: isStatic,
              optional: !!member.questionToken,
              parameters: getParameters(member),
              returnType: getReturnType(member),
              typeParams: getTypeParameters(member),
            };
          }
          if (ts.isPropertyDeclaration(member)) {
            return {
              kind: "prop",
              docs: getDocs(member),
              name: printPropertyName(member.name),
              optional: !!member.questionToken,
              type: member.type
                ? convertTypeNode(member.type)
                : convertType(getTypeChecker().getTypeAtLocation(member)),
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
      docs: getDocs(compilerNode),
      members: compilerNode.members.map((member) => {
        const symbol = getSymbolAtLocation(member.name);
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
      docs: getDocs(compilerNode),
      value: getTypeChecker().getConstantValue(compilerNode) ?? null,
    };
  }
  if (
    ts.isModuleDeclaration(compilerNode) &&
    ts.isIdentifier(compilerNode.name) &&
    compilerNode.body &&
    ts.isModuleBlock(compilerNode.body)
  ) {
    const symbol = getSymbolAtLocation(compilerNode);
    assert(symbol !== undefined, "expected module declaration to have symbol");
    return {
      kind: "namespace",
      name: symbol.getName(),
      docs: getDocs(compilerNode),
      exports: collectExportsFromModule(symbol),
    };
  }
  let docs = getDocs(compilerNode as any);
  const symbol = getSymbolAtLocation(compilerNode);
  assert(symbol !== undefined, "expected symbol to exist");
  console.log(symbol.getName(), ts.SyntaxKind[compilerNode.kind]);
  // console.log(
  //   Object.keys(ts.SymbolFlags).filter(
  //     (key) => symbol.flags & ts.SymbolFlags[key as keyof typeof ts.SymbolFlags]
  //   )
  // );
  return {
    kind: "unknown",
    name: symbol.getName(),
    docs,
    content: compilerNode.getText(),
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

function collectExportsFromModule(symbol: ts.Symbol) {
  let exports: Record<string, SymbolId | 0> = {};
  for (const [exportName, exportedDeclarations] of getExportedDeclarations(
    symbol
  )) {
    const decl = exportedDeclarations[0];
    if (!decl) {
      console.log(
        `no declarations for export ${exportName} in ${symbol.getName()}`
      );
      exports[exportName] = 0;
      continue;
    }
    let innerSymbol = getSymbolAtLocation(decl);
    assert(
      innerSymbol !== undefined,
      "expected symbol to exist for exported declaration"
    );
    innerSymbol = getAliasedSymbol(innerSymbol) || innerSymbol;
    collectSymbol(innerSymbol);
    exports[exportName] = getSymbolIdentifier(innerSymbol);
  }
  return exports;
}

function getJsDocsFromSourceFile(decl: ts.Node) {
  const jsDocs: ts.JSDoc[] = [];
  decl.forEachChild((node) => {
    if (!!(node as any).jsDoc) {
      const nodes: ts.JSDoc[] = (node as any).jsDoc ?? [];
      for (const doc of nodes) {
        if (doc.tags?.some((tag) => tag.tagName.text === "module")) {
          jsDocs.push(doc);
        }
      }
    }
  });
  return jsDocs;
}
