import { ts } from "../ts";
import {
  getTypeParameters,
  getParameters,
  getObjectMembers,
  getAliasedSymbol,
  getSymbolAtLocation,
  spreadTupleOrNone,
} from "./utils";
import { ExtractionHost, referenceSymbol } from ".";
import { assert, assertNever } from "../../lib/assert";
import { SerializedType, SymbolId, TupleElement } from "../../lib/types";

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

function handleReference<Docs>(
  typeArguments: ts.NodeArray<ts.TypeNode> | undefined,
  typeName: ts.Node,
  host: ExtractionHost<Docs>
): SerializedType<Docs> {
  let symbol = getSymbolAtLocation(typeName, host);
  if (!symbol) {
    return {
      kind: "reference",
      id: "unknown" as SymbolId,
      name: printNode(typeName),
      ...spreadTupleOrNone(
        "typeArguments",
        typeArguments?.map((x) => convertTypeNode(x, host))
      ),
    };
  }

  if (symbol.flags & ts.SymbolFlags.TypeParameter) {
    return {
      kind: "type-parameter",
      name: symbol.getName(),
    };
  }

  symbol = getAliasedSymbol(symbol, host);

  if (symbol.getName() === "Array") {
    assert(typeArguments?.length === 1);
    return {
      kind: "array",
      readonly: false,
      inner: convertTypeNode(typeArguments[0], host),
    };
  }
  if (symbol.getName() === "ReadonlyArray") {
    assert(typeArguments?.length === 1);
    return {
      kind: "array",
      readonly: true,
      inner: convertTypeNode(typeArguments[0], host),
    };
  }
  const fullName = referenceSymbol(symbol, host);
  let name = symbol.getName();
  if (fullName === "unknown") {
    name = printNode(typeName);
  }

  return {
    kind: "reference",
    id: fullName,
    name,
    ...spreadTupleOrNone(
      "typeArguments",
      typeArguments?.map((x) => convertTypeNode(x, host))
    ),
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

export function convertTypeNode<Docs>(
  compilerNode: ts.TypeNode,
  host: ExtractionHost<Docs>
): SerializedType<Docs> {
  if (ts.isTypeReferenceNode(compilerNode)) {
    return handleReference(
      compilerNode.typeArguments,
      compilerNode.typeName,
      host
    );
  }
  if (ts.isExpressionWithTypeArguments(compilerNode)) {
    return handleReference(
      compilerNode.typeArguments,
      compilerNode.expression,
      host
    );
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
      return { kind: "numeric-literal", value: literal.text };
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
    if (ts.isPrefixUnaryExpression(literal)) {
      if (literal.operator === ts.SyntaxKind.MinusToken) {
        assert(ts.isNumericLiteral(literal.operand));
        return {
          kind: "prefix-unary",
          operator: "-",
          value: literal.operand.text,
        };
      }
      if (literal.operator === ts.SyntaxKind.PlusToken) {
        assert(ts.isNumericLiteral(literal.operand));
        return {
          kind: "prefix-unary",
          operator: "+",
          value: literal.operand.text,
        };
      }
    }
    debugger;
  }

  if (ts.isUnionTypeNode(compilerNode)) {
    return {
      kind: "union",
      types: compilerNode.types.map((x) => convertTypeNode(x, host)),
    };
  }
  if (ts.isIndexedAccessTypeNode(compilerNode)) {
    return {
      kind: "indexed-access",
      object: convertTypeNode(compilerNode.objectType, host),
      index: convertTypeNode(compilerNode.indexType, host),
    };
  }
  if (ts.isConditionalTypeNode(compilerNode)) {
    return {
      kind: "conditional",
      checkType: convertTypeNode(compilerNode.checkType, host),
      extendsType: convertTypeNode(compilerNode.extendsType, host),
      trueType: convertTypeNode(compilerNode.trueType, host),
      falseType: convertTypeNode(compilerNode.falseType, host),
    };
  }
  if (ts.isParenthesizedTypeNode(compilerNode)) {
    return {
      kind: "paren",
      value: convertTypeNode(compilerNode.type, host),
    };
  }

  if (ts.isInferTypeNode(compilerNode)) {
    return {
      kind: "infer",
      name: compilerNode.typeParameter.name.text,
      ...(compilerNode.typeParameter.constraint
        ? {
            constraint: convertTypeNode(
              compilerNode.typeParameter.constraint,
              host
            ),
          }
        : {}),
    };
  }

  if (ts.isIntersectionTypeNode(compilerNode)) {
    return {
      kind: "intersection",
      types: compilerNode.types.map((x) => convertTypeNode(x, host)),
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
        constraint: convertTypeNode(typeParam.constraint, host),
      },
      type: compilerNode.type
        ? convertTypeNode(compilerNode.type, host)
        : { kind: "intrinsic", value: "any" },
      ...(compilerNode.nameType
        ? { as: convertTypeNode(compilerNode.nameType, host) }
        : {}),
      optional: getModifierKind(compilerNode.questionToken),
      readonly: getModifierKind(compilerNode.readonlyToken),
    };
  }
  if (ts.isTypeLiteralNode(compilerNode)) {
    return {
      kind: "object",
      ...spreadTupleOrNone("members", getObjectMembers(compilerNode, host)),
    };
  }

  if (ts.isFunctionTypeNode(compilerNode)) {
    return {
      kind: "signature",
      ...spreadTupleOrNone("parameters", getParameters(compilerNode, host)),
      ...spreadTupleOrNone("typeParams", getTypeParameters(compilerNode, host)),
      returnType: convertTypeNode(compilerNode.type, host),
    };
  }

  if (ts.isConstructorTypeNode(compilerNode)) {
    return {
      kind: "constructor",
      ...spreadTupleOrNone("parameters", getParameters(compilerNode, host)),
      ...spreadTupleOrNone("typeParams", getTypeParameters(compilerNode, host)),
      returnType: convertTypeNode(compilerNode.type, host),
    };
  }

  if (ts.isArrayTypeNode(compilerNode)) {
    return {
      kind: "array",
      readonly: false,
      inner: convertTypeNode(compilerNode.elementType, host),
    };
  }

  if (ts.isTupleTypeNode(compilerNode)) {
    return {
      kind: "tuple",
      readonly: false,
      ...spreadTupleOrNone(
        "elements",
        compilerNode.elements.map((element): TupleElement<Docs> => {
          if (ts.isNamedTupleMember(element)) {
            return {
              kind: element.dotDotDotToken
                ? "rest"
                : element.questionToken
                ? "optional"
                : "required",
              label: element.name.text,
              type: convertTypeNode(element.type, host),
            };
          }
          let innerType = element;
          const isOptional = ts.isOptionalTypeNode(element);
          const isRest = ts.isRestTypeNode(element);
          let kind: TupleElement<Docs>["kind"] = "required";
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
            type: convertTypeNode(innerType, host),
          };
        })
      ),
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
      const inner = convertTypeNode(compilerNode.type, host);
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
        value: convertTypeNode(compilerNode.type, host),
      };
    }
    assertNever(compilerNode.operator);
  }

  if (ts.isImportTypeNode(compilerNode)) {
    if (compilerNode.isTypeOf) {
      let node = compilerNode.qualifier || compilerNode;
      let symbol = getSymbolAtLocation(node, host);
      if (symbol) {
        symbol = getAliasedSymbol(symbol, host);

        return {
          kind: "typeof",
          id: referenceSymbol(symbol, host),
          name: symbol.getName(),
        };
      }

      return {
        kind: "typeof",
        id: "unknown" as SymbolId,
        name: compilerNode.qualifier
          ? printEntityName(compilerNode.qualifier)
          : printNode(compilerNode),
      };
    }
    let qualifier = compilerNode.qualifier;
    if (qualifier) {
      return handleReference(compilerNode.typeArguments, qualifier, host);
    }
    assert(false);
  }

  if (ts.isTypeQueryNode(compilerNode)) {
    const entityName = compilerNode.exprName;
    let symbol = getSymbolAtLocation(entityName, host);
    if (symbol) {
      symbol = getAliasedSymbol(symbol, host);
      return {
        kind: "typeof",
        id: referenceSymbol(symbol, host),
        name: symbol.getName(),
      };
    }

    return {
      kind: "typeof",
      id: "unknown" as SymbolId,
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
        ? { type: convertTypeNode(compilerNode.type, host) }
        : {}),
    };
  }

  if (ts.isTemplateLiteralTypeNode(compilerNode)) {
    return {
      kind: "template",
      head: compilerNode.head.text,
      ...spreadTupleOrNone(
        "rest",
        compilerNode.templateSpans.map((element) => {
          return {
            type: convertTypeNode(element.type, host),
            text: element.literal.text,
          };
        })
      ),
    };
  }

  return {
    kind: "raw",
    value: `${compilerNode.getText()} ${ts.SyntaxKind[compilerNode.kind]}`,
  };
}
