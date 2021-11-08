import { ts } from "../ts";
import { convertTypeNode } from "./convert-node";
import { convertType } from "./convert-type";
import hashString from "@emotion/hash";
import { assert } from "../../lib/assert";
import { getTypeChecker } from ".";
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
  }
): TypeParam[] {
  return (node.typeParameters || []).map((typeParam) => {
    return {
      name: typeParam.name.text,
      constraint: typeParam.constraint
        ? convertTypeNode(typeParam.constraint)
        : null,
      default: typeParam.default ? convertTypeNode(typeParam.default) : null,
    };
  });
}

export function getObjectMembers(
  node: ts.Node & {
    members: ts.NodeArray<ts.TypeElement>;
  }
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
        key: convertTypeNode(member.parameters[0].type!),
        value: convertTypeNode(member.type),
        readonly:
          member.modifiers?.some(
            (x) => x.kind === ts.SyntaxKind.ReadonlyKeyword
          ) || false,
        docs: getDocs(member),
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
        docs: getDocs(member),
        optional: !!member.questionToken,
        readonly:
          member.modifiers?.some(
            (x) => x.kind === ts.SyntaxKind.ReadonlyKeyword
          ) || false,
        type: member.type
          ? convertTypeNode(member.type)
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
        parameters: getParameters(member),
        typeParams: getTypeParameters(member),
        docs: getDocs(member),
        returnType: getReturnType(member),
      };
    }
    const isCallSignature = ts.isCallSignatureDeclaration(member);
    if (isCallSignature || ts.isConstructSignatureDeclaration(member)) {
      assert(member.questionToken === undefined);
      return {
        kind: isCallSignature ? "call" : "constructor",
        parameters: getParameters(member),
        typeParams: getTypeParameters(member),
        docs: getDocs(member),
        returnType: getReturnType(member),
      };
    }
    return { kind: "unknown", content: member.getText() };
  });
}

export function getParameters(
  node: ts.Node & {
    parameters: ts.NodeArray<ts.ParameterDeclaration>;
  }
): Parameter[] {
  return node.parameters.map((x): Parameter => {
    return {
      name: ts.isIdentifier(x.name) ? x.name.text : x.name.getText(),
      type: x.type
        ? convertTypeNode(x.type)
        : convertType(getTypeChecker().getTypeAtLocation(x)),
      kind: x.dotDotDotToken
        ? "rest"
        : x.questionToken || x.initializer
        ? "optional"
        : "normal",
    };
  });
}

function getJsDocCommentTextMarkdown(
  comment: string | undefined | ts.NodeArray<ts.JSDocComment>
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
        const symbol = getSymbolAtLocation(x.name);
        if (symbol) {
          const finalSymbol = getAliasedSymbol(symbol) || symbol;

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

export function getAliasedSymbol(symbol: ts.Symbol): ts.Symbol | undefined {
  if (!(symbol.flags & ts.SymbolFlags.Alias)) {
    return undefined;
  }
  return getTypeChecker().getAliasedSymbol(symbol);
}

export function getDocsFromJSDocNodes(nodes: ts.JSDoc[]) {
  return nodes
    .map((x) => {
      let fromTags = (x.tags || [])
        .filter((x) => x.tagName.text !== "module")
        .map((x) => {
          return `@${x.tagName.text} — ${getJsDocCommentTextMarkdown(
            x.comment
          )}`;
        })
        .join("\n\n");
      if (fromTags) {
        fromTags = `\n\n${fromTags}`;
      }
      return getJsDocCommentTextMarkdown(x.comment) + fromTags;
    })
    .join("\n\n");
}

export function getDocs(decl: ts.HasJSDoc) {
  let nodes = ((decl as any).jsDoc ?? []) as ts.JSDoc[];
  return getDocsFromJSDocNodes(
    nodes.filter(
      (x) =>
        x.tags === undefined || x.tags.every((x) => x.tagName.text !== "module")
    )
  );
}

export function getSymbolIdentifier(symbol: ts.Symbol): SymbolId {
  if (!symbol.declarations?.length) {
    const fullName = getTypeChecker().getFullyQualifiedName(symbol);
    if (
      fullName === "unknown" ||
      fullName === "globalThis" ||
      fullName === "undefined"
    ) {
      return fullName as SymbolId;
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
  compilerNode: ts.Node
): ts.Symbol | undefined {
  const typeChecker = getTypeChecker();
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
    return getSymbolAtLocation(nameNode);
  }

  return undefined;
}

export function getReturnType(node: ts.SignatureDeclaration): SerializedType {
  if (node.type) {
    return convertTypeNode(node.type);
  }
  const signature = getTypeChecker().getSignatureFromDeclaration(node);
  assert(
    signature !== undefined,
    "expected to always get signature from signature declaration"
  );
  const returnType = signature.getReturnType();
  return convertType(returnType);
}
