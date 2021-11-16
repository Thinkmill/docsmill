import { ts } from "../ts";
import { convertTypeNode } from "./convert-node";
import { convertType } from "./convert-type";
import hashString from "@emotion/hash";
import { assert } from "../../lib/assert";
import { ExtractionHost, getTypeChecker } from ".";
import {
  TypeParam,
  ObjectMember,
  Parameter,
  SerializedType,
  SymbolId,
} from "../../lib/types";

export function getTypeParameters(
  node: ts.Node & {
    typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration>;
  },
  host: ExtractionHost
): TypeParam[] {
  return (node.typeParameters || []).map((typeParam) => {
    return {
      name: typeParam.name.text,
      constraint: typeParam.constraint
        ? convertTypeNode(typeParam.constraint, host)
        : null,
      default: typeParam.default
        ? convertTypeNode(typeParam.default, host)
        : null,
    };
  });
}

export function getObjectMembers(
  node: ts.Node & {
    members: ts.NodeArray<ts.TypeElement>;
  },
  host: ExtractionHost
): ObjectMember[] {
  return node.members.map((member): ObjectMember => {
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
        parameters: getParameters(member, host),
        typeParams: getTypeParameters(member, host),
        docs: getDocs(member, host),
        returnType: getReturnType(member, host),
      };
    }
    const isCallSignature = ts.isCallSignatureDeclaration(member);
    if (isCallSignature || ts.isConstructSignatureDeclaration(member)) {
      assert(member.questionToken === undefined);
      return {
        kind: isCallSignature ? "call" : "constructor",
        parameters: getParameters(member, host),
        typeParams: getTypeParameters(member, host),
        docs: getDocs(member, host),
        returnType: getReturnType(member, host),
      };
    }
    return { kind: "unknown", content: member.getText() };
  });
}

export function getParameters(
  node: ts.Node & {
    parameters: ts.NodeArray<ts.ParameterDeclaration>;
  },
  host: ExtractionHost
): Parameter[] {
  return node.parameters.map((x): Parameter => {
    return {
      name: ts.isIdentifier(x.name) ? x.name.text : x.name.getText(),
      type: x.type
        ? convertTypeNode(x.type, host)
        : convertType(getTypeChecker(host).getTypeAtLocation(x), host),
      kind: x.dotDotDotToken
        ? "rest"
        : x.questionToken || x.initializer
        ? "optional"
        : "normal",
    };
  });
}

function getJsDocCommentTextMarkdown(
  comment: string | undefined | ts.NodeArray<ts.JSDocComment>,
  host: ExtractionHost
) {
  if (comment === undefined) {
    return "";
  }
  if (typeof comment === "string") {
    return comment;
  }

  return comment
    .map((x) => {
      if (ts.isJSDocLink(x) && x.name) {
        const symbol = getSymbolAtLocation(x.name, host);
        if (symbol) {
          const finalSymbol = getAliasedSymbol(symbol, host);

          return `[${
            x.text || finalSymbol.getName()
          }](#symbol-${getSymbolIdentifier(finalSymbol)})`;
        } else {
          console.log(
            "could not get symbol for link with text at:",
            x.getFullText(),
            x.getSourceFile().fileName
          );
        }
      }

      return x.text;
    })
    .join("");
}

export function getAliasedSymbol(
  symbol: ts.Symbol,
  host: ExtractionHost
): ts.Symbol {
  if ((symbol as any).mergeId !== undefined) {
    return getAliasedSymbol(
      (getTypeChecker(host) as any).getMergedSymbol(symbol),
      host
    );
  }
  if (symbol.flags & ts.SymbolFlags.Alias) {
    return getAliasedSymbol(
      getTypeChecker(host).getAliasedSymbol(symbol),
      host
    );
  }
  return symbol;
}

export function getDocsFromJSDocNodes(nodes: ts.JSDoc[], host: ExtractionHost) {
  return nodes
    .map((x) => {
      let fromTags = (x.tags || [])
        .filter((x) => x.tagName.text !== "module")
        .map((x) => {
          return `@${x.tagName.text} — ${getJsDocCommentTextMarkdown(
            x.comment,
            host
          )}`;
        })
        .join("\n\n");
      if (fromTags) {
        fromTags = `\n\n${fromTags}`;
      }
      return getJsDocCommentTextMarkdown(x.comment, host) + fromTags;
    })
    .join("\n\n");
}

export function getDocs(decl: ts.HasJSDoc, host: ExtractionHost) {
  let nodes = ((decl as any).jsDoc ?? []) as ts.JSDoc[];
  return getDocsFromJSDocNodes(
    nodes.filter(
      (x) =>
        x.tags === undefined || x.tags.every((x) => x.tagName.text !== "module")
    ),
    host
  );
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
    assert(false, "expected at least one declaration");
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
  host: ExtractionHost
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

export function getReturnType(
  node: ts.SignatureDeclaration,
  host: ExtractionHost
): SerializedType {
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
