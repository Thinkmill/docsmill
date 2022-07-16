import { ts } from "./ts";
import { ExtractionHost, getTypeChecker, referenceSymbol } from ".";
import { ClassMember, SerializedDeclaration, SymbolId } from "@docsmill/types";
import { convertTypeNode } from "./convert-node";
import { convertType } from "./convert-type";
import {
  getDocs,
  getTypeParameters,
  getParameters,
  getObjectMembers,
  getAliasedSymbol,
  getSymbolAtLocation,
  getReturnType,
  spreadTupleOrNone,
} from "./utils";
import { assert } from "emery/assertions";

export function convertDeclaration<Docs>(
  compilerNode: ts.Node,
  host: ExtractionHost<Docs>
): SerializedDeclaration<Docs> {
  if (ts.isTypeAliasDeclaration(compilerNode)) {
    return {
      kind: "type-alias",
      name: compilerNode.name.text,
      docs: getDocs(compilerNode, host),
      ...spreadTupleOrNone("typeParams", getTypeParameters(compilerNode, host)),
      type: convertTypeNode(compilerNode.type, host),
    };
  }

  if (ts.isFunctionDeclaration(compilerNode)) {
    return {
      kind: "function",
      // the only case where a function declaration doesn't have a name is when it's a default export
      // (yes, function expressions never have to have names but this is a function declaration, not a function expression)
      name: compilerNode.name?.text || "default",
      docs: getDocs(compilerNode, host),
      ...spreadTupleOrNone("parameters", getParameters(compilerNode, host)),
      ...spreadTupleOrNone("typeParams", getTypeParameters(compilerNode, host)),
      returnType: getReturnType(compilerNode, host),
    };
  }
  if (
    ts.isSourceFile(compilerNode) ||
    (ts.isModuleDeclaration(compilerNode) &&
      ts.isStringLiteral(compilerNode.name))
  ) {
    const symbol = getSymbolAtLocation(compilerNode, host);

    assert(symbol !== undefined, "expected symbol to exist");
    let exports: Record<string, SymbolId> = {};
    const typeChecker = getTypeChecker(host);
    const exportSymbols = typeChecker.getExportsOfModule(symbol);
    for (let exportSymbol of exportSymbols) {
      const aliasedSymbol = getAliasedSymbol(exportSymbol, host);
      exports[exportSymbol.name] = referenceSymbol(aliasedSymbol, host);
    }
    return {
      kind: "module",
      name: ts.isModuleDeclaration(compilerNode)
        ? (compilerNode.name as ts.StringLiteral).text
        : compilerNode.fileName,
      docs: host.getDocs(compilerNode),
      exports,
    };
  }
  if (ts.isBindingElement(compilerNode) && ts.isIdentifier(compilerNode.name)) {
    return {
      kind: "variable",
      name: compilerNode.name.text,
      docs: host.getDocs(compilerNode),
      variableKind: "const",
      type: convertType(
        getTypeChecker(host).getTypeAtLocation(compilerNode),
        host
      ),
    };
  }
  if (ts.isVariableDeclaration(compilerNode)) {
    const variableStatement = compilerNode.parent.parent;
    assert(
      ts.isVariableStatement(variableStatement),
      "expected to only get variable declarations as part of a variable statement"
    );

    const docs = getDocs(compilerNode, host);

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
        docs,
        ...spreadTupleOrNone(
          "parameters",
          getParameters(compilerNode.initializer, host)
        ),
        ...spreadTupleOrNone(
          "typeParams",
          getTypeParameters(compilerNode.initializer, host)
        ),
        returnType: getReturnType(compilerNode.initializer, host),
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
        ? convertTypeNode(compilerNode.type, host)
        : convertType(
            getTypeChecker(host).getTypeAtLocation(compilerNode),
            host
          ),
    };
  }
  if (ts.isPropertySignature(compilerNode)) {
    return {
      kind: "variable",
      name: printPropertyName(compilerNode.name),
      docs: getDocs(compilerNode, host),
      variableKind: "const",
      type: compilerNode.type
        ? convertTypeNode(compilerNode.type, host)
        : convertType(
            getTypeChecker(host).getTypeAtLocation(compilerNode),
            host
          ),
    };
  }
  if (ts.isInterfaceDeclaration(compilerNode)) {
    return {
      kind: "interface",
      name: compilerNode.name.text,
      docs: getDocs(compilerNode, host),

      ...spreadTupleOrNone("typeParams", getTypeParameters(compilerNode, host)),
      ...spreadTupleOrNone(
        "extends",
        compilerNode.heritageClauses?.flatMap((x) => {
          assert(
            x.token === ts.SyntaxKind.ExtendsKeyword,
            "expected interface declaration to only have extends and never implements"
          );
          return x.types.map((x) => convertTypeNode(x, host));
        })
      ),
      ...spreadTupleOrNone("members", getObjectMembers(compilerNode, host)),
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
      docs: getDocs(compilerNode, host),
      ...spreadTupleOrNone("typeParams", getTypeParameters(compilerNode, host)),
      ...(extendsNode
        ? { extends: convertTypeNode(extendsNode.types[0], host) }
        : {}),
      ...spreadTupleOrNone(
        "implements",
        implementsNode?.types?.map((x) => convertTypeNode(x, host))
      ),
      willBeComparedNominally: compilerNode.members.some((member) => {
        member.modifiers?.some(
          (x) =>
            x.kind === ts.SyntaxKind.PrivateKeyword ||
            x.kind === ts.SyntaxKind.ProtectedKeyword
        ) ||
          (member.name && ts.isPrivateIdentifier(member.name));
      }),
      ...spreadTupleOrNone(
        "constructors",
        compilerNode.members.flatMap((x) => {
          if (!ts.isConstructorDeclaration(x)) {
            return [];
          }
          return [
            {
              docs: getDocs(x, host),
              ...spreadTupleOrNone("parameters", getParameters(x, host)),
            },
          ];
        })
      ),
      ...spreadTupleOrNone(
        "members",
        compilerNode.members
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
          .map((member): ClassMember<Docs> => {
            const isStatic =
              member.modifiers?.some(
                (x) => x.kind === ts.SyntaxKind.StaticKeyword
              ) || false;
            if (ts.isMethodDeclaration(member)) {
              // TODO: show protected
              // (and have a tooltip explaining what protected does)
              return {
                kind: "method",
                docs: getDocs(member, host),
                name: printPropertyName(member.name),
                static: isStatic,
                optional: !!member.questionToken,
                ...spreadTupleOrNone("parameters", getParameters(member, host)),
                ...spreadTupleOrNone(
                  "typeParams",
                  getTypeParameters(member, host)
                ),
                returnType: getReturnType(member, host),
              };
            }
            if (ts.isPropertyDeclaration(member)) {
              return {
                kind: "prop",
                docs: getDocs(member, host),
                name: printPropertyName(member.name),
                optional: !!member.questionToken,
                type: member.type
                  ? convertTypeNode(member.type, host)
                  : convertType(
                      getTypeChecker(host).getTypeAtLocation(member),
                      host
                    ),
                static: isStatic,
                readonly:
                  member.modifiers?.some(
                    (x) => x.kind === ts.SyntaxKind.ReadonlyKeyword
                  ) || false,
              };
            }
            return { kind: "unknown", content: member.getText() };
          })
      ),
    };
  }
  if (ts.isEnumDeclaration(compilerNode)) {
    return {
      kind: "enum",
      const: !!compilerNode.modifiers?.some(
        (x) => x.kind === ts.SyntaxKind.ConstKeyword
      ),
      name: compilerNode.name.text,
      docs: getDocs(compilerNode, host),
      members: compilerNode.members.map((member) => {
        const symbol = getSymbolAtLocation(member.name, host);
        assert(symbol !== undefined, "expected enum member to have symbol");
        return referenceSymbol(symbol, host);
      }),
    };
  }
  if (ts.isEnumMember(compilerNode)) {
    return {
      kind: "enum-member",
      name: ts.isIdentifier(compilerNode.name)
        ? compilerNode.name.text
        : compilerNode.name.getText(),
      docs: getDocs(compilerNode, host),
      value: getTypeChecker(host).getConstantValue(compilerNode) ?? null,
    };
  }
  if (
    ts.isModuleDeclaration(compilerNode) &&
    ts.isIdentifier(compilerNode.name) &&
    compilerNode.body &&
    ts.isModuleBlock(compilerNode.body)
  ) {
    const symbol = getSymbolAtLocation(compilerNode, host);
    assert(symbol !== undefined, "expected module declaration to have symbol");
    const exports: Record<string, SymbolId> = {};
    if (symbol.exports) {
      for (const [name, _exportedSymbol] of symbol.exports as Map<
        string,
        ts.Symbol
      >) {
        const exportedSymbol: ts.Symbol = _exportedSymbol;
        if (
          exportedSymbol.declarations?.[0] &&
          exportedSymbol.declarations[0].pos >= compilerNode.body.pos &&
          exportedSymbol.declarations[0].end <= compilerNode.body.end
        ) {
          const aliasedSymbol = getAliasedSymbol(exportedSymbol, host);
          exports[name] = referenceSymbol(aliasedSymbol, host);
        }
      }
    }
    return {
      kind: "namespace",
      name: compilerNode.name.text,
      docs: getDocs(compilerNode, host),
      exports,
    };
  }
  let docs = getDocs(compilerNode as any, host);
  const symbol = getSymbolAtLocation(compilerNode, host);
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
