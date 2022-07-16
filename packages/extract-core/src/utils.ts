import { ts } from "./ts";
import { convertTypeNode } from "./convert-node";
import { convertType } from "./convert-type";
import hashString from "@emotion/hash";
import { assert } from "emery/assertions";
import { ExtractionHost, getTypeChecker } from ".";
import {
  TypeParam,
  ObjectMember,
  Parameter,
  SerializedType,
  SymbolId,
} from "@docsmill/types";

export function getTypeParameters<Docs>(
  node: ts.Node & {
    typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration>;
  },
  host: ExtractionHost<Docs>
): TypeParam<Docs>[] {
  if (node.typeParameters === undefined) return [];
  return node.typeParameters.map((typeParam) => {
    let hasIn = false;
    let hasOut = false;
    if (typeParam.modifiers !== undefined) {
      for (const modifier of typeParam.modifiers) {
        if (modifier.kind === ts.SyntaxKind.InKeyword) {
          hasIn = true;
        } else if (modifier.kind === ts.SyntaxKind.OutKeyword) {
          hasOut = true;
        }
      }
    }

    const variance =
      hasIn && hasOut ? "in out" : hasIn ? "in" : hasOut ? "out" : undefined;
    return {
      name: typeParam.name.text,
      ...(typeParam.constraint
        ? { constraint: convertTypeNode(typeParam.constraint, host) }
        : {}),
      ...(typeParam.default
        ? { default: convertTypeNode(typeParam.default, host) }
        : {}),
      ...(variance && { variance }),
    };
  });
}

export function getObjectMembers<Docs>(
  node: ts.Node & {
    members: ts.NodeArray<ts.TypeElement>;
  },
  host: ExtractionHost<Docs>
): ObjectMember<Docs>[] {
  return node.members.map((member): ObjectMember<Docs> => {
    assert(member.decorators === undefined);
    if (ts.isIndexSignatureDeclaration(member)) {
      assert(member.questionToken === undefined);
      assert(member.typeParameters === undefined);
      assert(member.parameters.length === 1);
      assert(
        member.modifiers?.find(
          (x) => x.kind !== ts.SyntaxKind.ReadonlyKeyword
        ) === undefined
      );
      return {
        kind: "index",
        key: convertTypeNode(member.parameters[0].type!, host),
        value: convertTypeNode(member.type, host),
        readonly:
          member.modifiers?.some(
            (x) => x.kind === ts.SyntaxKind.ReadonlyKeyword
          ) || false,
        docs: getDocs(member, host),
      };
    }

    if (ts.isPropertySignature(member)) {
      assert(member.initializer === undefined);
      assert(
        member.modifiers?.find(
          (x) => x.kind !== ts.SyntaxKind.ReadonlyKeyword
        ) === undefined
      );
      return {
        kind: "prop",
        name: ts.isIdentifier(member.name)
          ? member.name.text
          : member.name.getText(),
        docs: getDocs(member, host),
        optional: !!member.questionToken,
        readonly:
          member.modifiers?.some(
            (x) => x.kind === ts.SyntaxKind.ReadonlyKeyword
          ) || false,
        type: member.type
          ? convertTypeNode(member.type, host)
          : { kind: "intrinsic", value: "any" },
      };
    }

    if (ts.isMethodSignature(member)) {
      return {
        kind: "method",
        name: ts.isIdentifier(member.name)
          ? member.name.text
          : member.name.getText(),
        optional: !!member.questionToken,
        ...spreadTupleOrNone("parameters", getParameters(member, host)),
        ...spreadTupleOrNone("typeParams", getTypeParameters(member, host)),
        docs: getDocs(member, host),
        returnType: getReturnType(member, host),
      };
    }
    const isCallSignature = ts.isCallSignatureDeclaration(member);
    if (isCallSignature || ts.isConstructSignatureDeclaration(member)) {
      assert(member.questionToken === undefined);
      return {
        kind: isCallSignature ? "call" : "constructor",
        ...spreadTupleOrNone("parameters", getParameters(member, host)),
        ...spreadTupleOrNone("typeParams", getTypeParameters(member, host)),
        docs: getDocs(member, host),
        returnType: getReturnType(member, host),
      };
    }
    return { kind: "unknown", content: member.getText() };
  });
}

export function spreadTupleOrNone<Key extends string, Element>(
  key: Key,
  array: readonly Element[] | undefined
): { [K in Key]?: [Element, ...Element[]] } {
  if (array === undefined || array.length === 0) {
    return {};
  }
  return { [key]: array } as any;
}

export function getParameters<Docs>(
  node: ts.Node & {
    parameters: ts.NodeArray<ts.ParameterDeclaration>;
  },
  host: ExtractionHost<Docs>
): Parameter<Docs>[] {
  return node.parameters.map((x): Parameter<Docs> => {
    const modifier = x.dotDotDotToken
      ? "rest"
      : x.questionToken || x.initializer
      ? "optional"
      : undefined;
    return {
      name: ts.isIdentifier(x.name) ? x.name.text : x.name.getText(),
      type: x.type
        ? convertTypeNode(x.type, host)
        : convertType(getTypeChecker(host).getTypeAtLocation(x), host),
      ...(modifier ? { modifier } : {}),
    };
  });
}

export function getAliasedSymbol(
  symbol: ts.Symbol,
  host: { program: ts.Program }
): ts.Symbol {
  if ((symbol as any).mergeId !== undefined) {
    const mergedSymbol = (getTypeChecker(host) as any).getMergedSymbol(symbol);
    if (mergedSymbol === symbol) {
      return mergedSymbol;
    }
    return getAliasedSymbol(mergedSymbol, host);
  }
  if (symbol.flags & ts.SymbolFlags.Alias) {
    return getAliasedSymbol(
      getTypeChecker(host).getAliasedSymbol(symbol),
      host
    );
  }
  return symbol;
}

export function getDocs<Docs>(
  decl: ts.HasJSDoc,
  host: ExtractionHost<Docs>
): Docs {
  return host.getDocs(decl);
}

export function getSymbolIdentifier(symbol: ts.Symbol): SymbolId {
  if (!symbol.declarations?.length) {
    if (
      symbol.name === "unknown" ||
      symbol.name === "globalThis" ||
      symbol.name === "undefined"
    ) {
      return symbol.name as SymbolId;
    }
    console.warn("no declaration for symbol", symbol.name);
    return symbol.name as SymbolId;
  }

  return hashString(
    symbol.declarations
      .map((decl) => {
        const filepath = decl.getSourceFile().fileName;
        return `${decl.kind}-${filepath}-${decl.pos}-${decl.end}`;
      })
      .join("-")
  ) as SymbolId;
}

export function getSymbolAtLocation(
  compilerNode: ts.Node,
  host: { program: ts.Program }
): ts.Symbol | undefined {
  const typeChecker = getTypeChecker(host);
  const boundSymbol = (compilerNode as any).symbol as ts.Symbol | undefined;
  if (boundSymbol !== undefined) {
    return boundSymbol;
  }

  const typeCheckerSymbol = typeChecker.getSymbolAtLocation(compilerNode);
  if (typeCheckerSymbol !== undefined) {
    return typeCheckerSymbol;
  }

  const nameNode = (compilerNode as any).name as ts.Node | undefined;
  if (nameNode != null) {
    return getSymbolAtLocation(nameNode, host);
  }

  return undefined;
}

export function getReturnType<Docs>(
  node: ts.SignatureDeclaration,
  host: ExtractionHost<Docs>
): SerializedType<Docs> {
  if (node.type) {
    return convertTypeNode(node.type, host);
  }
  const signature = getTypeChecker(host).getSignatureFromDeclaration(node);
  assert(
    signature !== undefined,
    "expected to always get signature from signature declaration"
  );
  const returnType = signature.getReturnType();
  return convertType(returnType, host);
}
