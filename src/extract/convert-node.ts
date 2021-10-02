import { ts } from "./ts";
import {
  getSymbolIdentifier,
  getTypeParameters,
  getParameters,
  getObjectMembers,
  getAliasedSymbol,
  getSymbolAtLocation,
} from "./utils";
import { collectSymbol } from ".";
import { assert, assertNever } from "../lib/assert";
import { SerializedType, TupleElement } from "../lib/types";

function getModifierKind(
  modifier:
    | ts.PlusToken
    | ts.MinusToken
    | ts.ReadonlyKeyword
    | ts.QuestionToken
    | undefined
): -1 | 0 | 1 {
  if (modifier === undefined) {
    return 0;
  }
  if (modifier.kind === ts.SyntaxKind.MinusToken) {
    return -1;
  }
  return 1;
}

function printEntityName(entityName: ts.EntityName): string {
  if (!entityName) {
    debugger;
  }
  if (ts.isIdentifier(entityName)) {
    return entityName.text;
  }
  return `${printEntityName(entityName.left)}.${entityName.right.text}`;
}

function printNode(node: ts.Node) {
  if (ts.isEntityName(node)) {
    return printEntityName(node);
  } else {
    try {
      return node.getText();
    } catch (err) {
      return ts
        .createPrinter()
        .printNode(ts.EmitHint.Unspecified, node, undefined as any);
    }
  }
}

function handleReference(
  typeArguments: ts.NodeArray<ts.TypeNode> | undefined,
  typeName: ts.Node
): SerializedType {
  let symbol = getSymbolAtLocation(typeName);
  if (!symbol) {
    return {
      kind: "reference",
      fullName: "unknown",
      name: printNode(typeName),
      typeArguments: (typeArguments || []).map((x) => convertTypeNode(x)),
    };
  }

  if (symbol.flags & ts.SymbolFlags.TypeParameter) {
    return {
      kind: "type-parameter",
      name: symbol.getName(),
    };
  }

  const aliasedSymbol = getAliasedSymbol(symbol);
  if (aliasedSymbol) {
    symbol = aliasedSymbol;
  }

  if (symbol.getName() === "Array") {
    assert(typeArguments !== undefined && typeArguments.length === 1);
    return {
      kind: "array",
      readonly: false,
      inner: convertTypeNode(typeArguments[0]),
    };
  }
  if (symbol.getName() === "ReadonlyArray") {
    assert(typeArguments !== undefined && typeArguments.length === 1);
    return {
      kind: "array",
      readonly: true,
      inner: convertTypeNode(typeArguments[0]),
    };
  }
  collectSymbol(symbol);
  const fullName = getSymbolIdentifier(symbol);
  let name = symbol.getName();
  if (fullName === "unknown") {
    name = printNode(typeName);
  }

  return {
    kind: "reference",
    fullName,
    name,
    typeArguments: (typeArguments || []).map((x) => convertTypeNode(x)),
  };
}

const intrinsics = new Map([
  [ts.SyntaxKind.AnyKeyword, "any"],
  [ts.SyntaxKind.UndefinedKeyword, "undefined"],
  [ts.SyntaxKind.SymbolKeyword, "symbol"],
  [ts.SyntaxKind.NeverKeyword, "never"],
  [ts.SyntaxKind.BooleanKeyword, "boolean"],
  [ts.SyntaxKind.ObjectKeyword, "object"],
  [ts.SyntaxKind.StringKeyword, "string"],
  [ts.SyntaxKind.NumberKeyword, "number"],
  [ts.SyntaxKind.VoidKeyword, "void"],
  [ts.SyntaxKind.UnknownKeyword, "unknown"],
  [ts.SyntaxKind.BigIntKeyword, "bigint"],
  [ts.SyntaxKind.IntrinsicKeyword, "intrinsic"],
  [ts.SyntaxKind.ThisType, "this"],
]);

export function convertTypeNode(compilerNode: ts.TypeNode): SerializedType {
  if (ts.isTypeReferenceNode(compilerNode)) {
    return handleReference(compilerNode.typeArguments, compilerNode.typeName);
  }
  if (ts.isExpressionWithTypeArguments(compilerNode)) {
    return handleReference(compilerNode.typeArguments, compilerNode.expression);
  }

  const intrinsic = intrinsics.get(compilerNode.kind);

  if (intrinsic !== undefined) {
    return { kind: "intrinsic", value: intrinsic };
  }

  if (ts.isLiteralTypeNode(compilerNode)) {
    const literal = compilerNode.literal;
    if (literal.kind === ts.SyntaxKind.NullKeyword) {
      return { kind: "intrinsic", value: "null" };
    }
    if (ts.isStringLiteral(literal)) {
      return { kind: "string-literal", value: literal.text };
    }
    if (ts.isNumericLiteral(literal)) {
      return { kind: "numeric-literal", value: Number(literal.text) };
    }
    if (ts.isBigIntLiteral(literal)) {
      return { kind: "bigint-literal", value: literal.text };
    }
    if (literal.kind === ts.SyntaxKind.TrueKeyword) {
      return { kind: "intrinsic", value: "true" };
    }
    if (literal.kind === ts.SyntaxKind.FalseKeyword) {
      return { kind: "intrinsic", value: "false" };
    }
  }

  if (ts.isUnionTypeNode(compilerNode)) {
    return {
      kind: "union",
      types: compilerNode.types.map((x) => convertTypeNode(x)),
    };
  }
  if (ts.isIndexedAccessTypeNode(compilerNode)) {
    return {
      kind: "indexed-access",
      object: convertTypeNode(compilerNode.objectType),
      index: convertTypeNode(compilerNode.indexType),
    };
  }
  if (ts.isConditionalTypeNode(compilerNode)) {
    return {
      kind: "conditional",
      checkType: convertTypeNode(compilerNode.checkType),
      extendsType: convertTypeNode(compilerNode.extendsType),
      trueType: convertTypeNode(compilerNode.trueType),
      falseType: convertTypeNode(compilerNode.falseType),
    };
  }
  if (ts.isParenthesizedTypeNode(compilerNode)) {
    return {
      kind: "paren",
      value: convertTypeNode(compilerNode.type),
    };
  }

  if (ts.isInferTypeNode(compilerNode)) {
    return { kind: "infer", name: compilerNode.typeParameter.name.text };
  }

  if (ts.isIntersectionTypeNode(compilerNode)) {
    return {
      kind: "intersection",
      types: compilerNode.types.map((x) => convertTypeNode(x)),
    };
  }
  if (ts.isMappedTypeNode(compilerNode)) {
    const typeParam = compilerNode.typeParameter;
    assert(
      typeParam.constraint !== undefined,
      "expected constraint to exist on type parameter in mapped type"
    );
    return {
      kind: "mapped",
      param: {
        name: typeParam.name.text,
        constraint: convertTypeNode(typeParam.constraint),
      },
      type: compilerNode.type
        ? convertTypeNode(compilerNode.type)
        : { kind: "intrinsic", value: "any" },
      as: compilerNode.nameType ? convertTypeNode(compilerNode.nameType) : null,
      optional: getModifierKind(compilerNode.questionToken),
      readonly: getModifierKind(compilerNode.readonlyToken),
    };
  }
  if (ts.isTypeLiteralNode(compilerNode)) {
    return {
      kind: "object",
      members: getObjectMembers(compilerNode),
    };
  }

  if (ts.isFunctionTypeNode(compilerNode)) {
    return {
      kind: "signature",
      parameters: getParameters(compilerNode),
      typeParams: getTypeParameters(compilerNode),
      returnType: convertTypeNode(compilerNode.type),
    };
  }

  if (ts.isConstructorTypeNode(compilerNode)) {
    return {
      kind: "constructor",
      parameters: getParameters(compilerNode),
      typeParams: getTypeParameters(compilerNode),
      returnType: convertTypeNode(compilerNode.type),
    };
  }

  if (ts.isArrayTypeNode(compilerNode)) {
    return {
      kind: "array",
      readonly: false,
      inner: convertTypeNode(compilerNode.elementType),
    };
  }

  if (ts.isTupleTypeNode(compilerNode)) {
    return {
      kind: "tuple",
      readonly: false,
      elements: compilerNode.elements.map((element): TupleElement => {
        if (ts.isNamedTupleMember(element)) {
          return {
            kind: element.dotDotDotToken
              ? "rest"
              : element.questionToken
              ? "optional"
              : "required",
            label: element.name.text,
            type: convertTypeNode(element.type),
          };
        }
        let innerType = element;
        const isOptional = ts.isOptionalTypeNode(element);
        const isRest = ts.isRestTypeNode(element);
        let kind: TupleElement["kind"] = "required";
        if (isOptional) {
          innerType = element.type;
          kind = "optional";
        }
        if (isRest) {
          innerType = element.type;
          kind = "rest";
        }
        return {
          kind,
          label: null,
          type: convertTypeNode(innerType),
        };
      }),
    };
  }

  if (ts.isTypeOperatorNode(compilerNode)) {
    if (compilerNode.operator === ts.SyntaxKind.UniqueKeyword) {
      assert(
        compilerNode.type.kind === ts.SyntaxKind.SymbolKeyword,
        "expected inner type of unique type operator to be symbol"
      );
      return { kind: "intrinsic", value: "unique symbol" };
    }
    if (compilerNode.operator === ts.SyntaxKind.ReadonlyKeyword) {
      const inner = convertTypeNode(compilerNode.type);
      if (inner.kind === "array" || inner.kind === "tuple") {
        return {
          ...inner,
          readonly: true,
        };
      }
      assert(
        false,
        `non-array type in readonly operator with kind: ${inner.kind}`
      );
    }
    if (compilerNode.operator === ts.SyntaxKind.KeyOfKeyword) {
      return {
        kind: "keyof",
        value: convertTypeNode(compilerNode.type),
      };
    }
    assertNever(compilerNode.operator);
  }

  if (ts.isImportTypeNode(compilerNode)) {
    if (compilerNode.isTypeOf) {
      let node = compilerNode.qualifier || compilerNode;
      let symbol = getSymbolAtLocation(node);
      if (symbol) {
        const aliasedSymbol = getAliasedSymbol(symbol);
        if (aliasedSymbol) {
          symbol = aliasedSymbol;
        }

        return {
          kind: "typeof",
          fullName: getSymbolIdentifier(symbol),
          name: symbol.getName(),
        };
      }

      return {
        kind: "typeof",
        fullName: "unknown",
        name: compilerNode.qualifier
          ? printEntityName(compilerNode.qualifier)
          : printNode(compilerNode),
      };
    }
    let qualifier = compilerNode.qualifier;
    if (qualifier) {
      return handleReference(compilerNode.typeArguments, qualifier);
    }
    assert(false);
  }

  if (ts.isTypeQueryNode(compilerNode)) {
    const entityName = compilerNode.exprName;
    let symbol = getSymbolAtLocation(entityName);
    if (symbol) {
      const aliasedSymbol = getAliasedSymbol(symbol);
      if (aliasedSymbol) {
        symbol = aliasedSymbol;
      }

      return {
        kind: "typeof",
        fullName: getSymbolIdentifier(symbol),
        name: symbol.getName(),
      };
    }

    return {
      kind: "typeof",
      fullName: "unknown",
      name: printEntityName(entityName),
    };
  }

  if (ts.isTypePredicateNode(compilerNode)) {
    return {
      kind: "type-predicate",
      asserts: !!compilerNode.assertsModifier,
      param:
        compilerNode.parameterName.kind === ts.SyntaxKind.ThisType
          ? "this"
          : compilerNode.parameterName.text,
      ...(compilerNode.type
        ? { type: convertTypeNode(compilerNode.type) }
        : {}),
    };
  }

  if (ts.isTemplateLiteralTypeNode(compilerNode)) {
    return {
      kind: "template",
      head: compilerNode.head.text,
      rest: compilerNode.templateSpans.map((element) => {
        return {
          type: convertTypeNode(element.type),
          text: element.literal.text,
        };
      }),
    };
  }

  debugger;

  return {
    kind: "raw",
    value: `${compilerNode.getText()} ${ts.SyntaxKind[compilerNode.kind]}`,
  };
}
