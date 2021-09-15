import {
  ArrowFunction,
  ClassDeclaration,
  ConstructorDeclaration,
  EnumDeclaration,
  EnumMember,
  FunctionDeclaration,
  InterfaceDeclaration,
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
  TypeAliasDeclaration,
  VariableDeclaration,
} from "ts-morph";
import { collectSymbol, getRootSymbolName } from ".";
import { ClassMember, SerializedDeclaration } from "../lib/types";
import { convertTypeNode } from "./convert-node";
import { _convertType } from "./convert-type";
import {
  getDocs,
  getTypeParameters,
  getParameters,
  getSymbolIdentifier,
  getDocsFromJSDocNodes,
  getObjectMembers,
} from "./utils";

export function convertDeclaration(decl: Node): SerializedDeclaration {
  if (decl instanceof TypeAliasDeclaration) {
    const typeNode = decl.getTypeNode();
    return {
      kind: "type-alias",
      name: decl.getName(),
      docs: getDocs(decl),
      typeParams: getTypeParameters(decl),
      type: typeNode
        ? convertTypeNode(typeNode)
        : _convertType(decl.getType(), 0),
    };
  }
  if (decl instanceof FunctionDeclaration) {
    const returnTypeNode = decl.getReturnTypeNode();
    return {
      kind: "function",
      // the only case where a function declaration doesn't have a name is when it's a default export
      // (yes, function expressions never have to have names but this is a function declaration, not a function expression)
      name: decl.getName() || "default",
      parameters: getParameters(decl),
      docs: getDocs(decl),
      typeParams: getTypeParameters(decl),
      returnType: returnTypeNode
        ? convertTypeNode(returnTypeNode)
        : _convertType(decl.getReturnType(), 0),
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
      docs: getDocsFromJSDocNodes(jsDocs),
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
          : _convertType(init.getReturnType(), 0),
      };
    }
    return {
      kind: "variable",
      name: decl.getName(),
      docs: getDocs(variableStatement),
      variableKind: variableStatement.getDeclarationKind(),
      type: typeNode
        ? convertTypeNode(typeNode)
        : _convertType(decl.getType(), 0),
    };
  }
  if (decl instanceof PropertySignature) {
    const typeNode = decl.getTypeNode();
    return {
      kind: "variable",
      name: decl.getName(),
      docs: getDocs(decl),
      variableKind: "const",
      type: typeNode
        ? convertTypeNode(typeNode)
        : _convertType(decl.getType(), 0),
    };
  }
  if (decl instanceof InterfaceDeclaration) {
    return {
      kind: "interface",
      name: decl.getName(),
      docs: getDocs(decl),
      typeParams: getTypeParameters(decl),
      extends: decl.getExtends().map((x) => convertTypeNode(x)),
      members: getObjectMembers(decl),
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
        .some(
          (member) =>
            member.hasModifier("private") ||
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
          member.hasModifier("private") ||
          member instanceof ConstructorDeclaration
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
                : _convertType(member.getReturnType(), 0),
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
                : _convertType(member.getType(), 0),
              static: member.isStatic(),
              readonly: member.isReadonly(),
            },
          ];
        }
        return [{ kind: "unknown", content: member.getText() }];
      }),
    };
  }
  if (decl instanceof EnumDeclaration) {
    return {
      kind: "enum",
      const: decl.isConstEnum(),
      name: decl.getName(),
      docs: getDocs(decl),
      members: decl.getMembers().map((member) => {
        const symbol = member.getSymbolOrThrow();
        collectSymbol(symbol);
        return getSymbolIdentifier(symbol);
      }),
    };
  }
  if (decl instanceof EnumMember) {
    return {
      kind: "enum-member",
      name: decl.getName(),
      docs: getDocs(decl),
      value: decl.getValue() ?? null,
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
