import {
  TypeNode,
  Node,
  ts,
  EntityName,
  CompilerNodeToWrappedType,
  TypeParameterDeclaration,
} from "ts-morph";
import {
  getParameters,
  getTypeParameters,
  getSymbolIdentifier,
  getObjectMembers,
} from "./utils";
import { _convertType } from "./convert-type";
import { collectSymbol } from ".";
import { fakeAssert, assert, assertNever } from "../lib/assert";
import { SerializedType, TupleElement } from "../lib/types";
import { assertEnumType } from "graphql";

function wrapInTsMorphNode<LocalCompilerNodeType extends ts.Node = ts.Node>(
  someNode: Node,
  compilerNode: LocalCompilerNodeType
): CompilerNodeToWrappedType<LocalCompilerNodeType> {
  return (someNode as any)._getNodeFromCompilerNode(compilerNode);
}

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

function handleReference(
  typeArguments: TypeNode[],
  typeName: EntityName
): SerializedType {
  let symbol = typeName.getSymbol();
  if (!symbol) {
    return {
      kind: "reference",
      fullName: "unknown",
      name: typeName.getText(),
      typeArguments: typeArguments.map((x) => convertTypeNode(x)),
    };
  }

  if (symbol.getDeclarations()?.[0] instanceof TypeParameterDeclaration) {
    return {
      kind: "type-parameter",
      name: symbol.getName(),
    };
  }

  if (
    symbol.getName() === "Array" &&
    symbol.getFullyQualifiedName() === "Array"
  ) {
    return {
      kind: "array",
      readonly: false,
      inner: convertTypeNode(typeArguments[0]),
    };
  }
  if (
    symbol.getName() === "ReadonlyArray" &&
    symbol.getFullyQualifiedName() === "ReadonlyArray"
  ) {
    return {
      kind: "array",
      readonly: true,
      inner: convertTypeNode(typeArguments[0]),
    };
  }
  symbol = symbol.getAliasedSymbol() || symbol;
  collectSymbol(symbol);
  const fullName = getSymbolIdentifier(symbol);
  let name = symbol.getName();
  if (fullName === "unknown") {
    name = typeName.getText();
  }

  return {
    kind: "reference",
    fullName,
    name,
    typeArguments: typeArguments.map((x) => convertTypeNode(x)),
  };
}

export function convertTypeNode(node: TypeNode): SerializedType {
  const compilerNode = node.compilerNode;
  if (ts.isTypeReferenceNode(compilerNode)) {
    return handleReference(
      (compilerNode.typeArguments ?? []).map((x) => wrapInTsMorphNode(node, x)),
      wrapInTsMorphNode(node, compilerNode.typeName)
    );
  }
  if (ts.isExpressionWithTypeArguments(compilerNode)) {
    return handleReference(
      (compilerNode.typeArguments ?? []).map((x) => wrapInTsMorphNode(node, x)),
      wrapInTsMorphNode(node, compilerNode.expression) as EntityName
    );
  }

  if (compilerNode.kind === ts.SyntaxKind.AnyKeyword) {
    return { kind: "intrinsic", value: "any" };
  }
  if (compilerNode.kind === ts.SyntaxKind.UndefinedKeyword) {
    return { kind: "intrinsic", value: "undefined" };
  }
  if (compilerNode.kind === ts.SyntaxKind.SymbolKeyword) {
    return { kind: "intrinsic", value: "symbol" };
  }
  if (compilerNode.kind === ts.SyntaxKind.NeverKeyword) {
    return { kind: "intrinsic", value: "never" };
  }
  if (compilerNode.kind === ts.SyntaxKind.BooleanKeyword) {
    return { kind: "intrinsic", value: "boolean" };
  }
  if (compilerNode.kind === ts.SyntaxKind.ObjectKeyword) {
    return { kind: "intrinsic", value: "object" };
  }
  if (compilerNode.kind === ts.SyntaxKind.StringKeyword) {
    return { kind: "intrinsic", value: "string" };
  }
  if (compilerNode.kind === ts.SyntaxKind.NumberKeyword) {
    return { kind: "intrinsic", value: "number" };
  }
  if (compilerNode.kind === ts.SyntaxKind.VoidKeyword) {
    return { kind: "intrinsic", value: "void" };
  }
  if (compilerNode.kind === ts.SyntaxKind.UnknownKeyword) {
    return { kind: "intrinsic", value: "unknown" };
  }
  if (compilerNode.kind === ts.SyntaxKind.BigIntKeyword) {
    return { kind: "intrinsic", value: "bigint" };
  }
  if (compilerNode.kind === ts.SyntaxKind.IntrinsicKeyword) {
    return { kind: "intrinsic", value: "intrinsic" };
  }

  if (ts.isThisTypeNode(compilerNode)) {
    return { kind: "intrinsic", value: "this" };
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
      types: compilerNode.types.map((x) =>
        convertTypeNode(wrapInTsMorphNode(node, x))
      ),
    };
  }
  if (ts.isIndexedAccessTypeNode(compilerNode)) {
    return {
      kind: "indexed-access",
      object: convertTypeNode(wrapInTsMorphNode(node, compilerNode.objectType)),
      index: convertTypeNode(wrapInTsMorphNode(node, compilerNode.indexType)),
    };
  }
  if (ts.isConditionalTypeNode(compilerNode)) {
    return {
      kind: "conditional",
      checkType: convertTypeNode(
        wrapInTsMorphNode(node, compilerNode.checkType)
      ),
      extendsType: convertTypeNode(
        wrapInTsMorphNode(node, compilerNode.extendsType)
      ),
      trueType: convertTypeNode(wrapInTsMorphNode(node, compilerNode.trueType)),
      falseType: convertTypeNode(
        wrapInTsMorphNode(node, compilerNode.falseType)
      ),
    };
  }
  if (ts.isParenthesizedTypeNode(compilerNode)) {
    return {
      kind: "paren",
      value: convertTypeNode(wrapInTsMorphNode(node, compilerNode.type)),
    };
  }

  if (ts.isInferTypeNode(compilerNode)) {
    return { kind: "infer", name: compilerNode.typeParameter.name.text };
  }

  if (ts.isIntersectionTypeNode(compilerNode)) {
    return {
      kind: "intersection",
      types: compilerNode.types.map((x) =>
        convertTypeNode(wrapInTsMorphNode(node, x))
      ),
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
        constraint: convertTypeNode(
          wrapInTsMorphNode(node, typeParam.constraint)
        ),
      },
      type: compilerNode.type
        ? convertTypeNode(wrapInTsMorphNode(node, compilerNode.type))
        : { kind: "intrinsic", value: "any" },
      as: compilerNode.nameType
        ? convertTypeNode(wrapInTsMorphNode(node, compilerNode.nameType))
        : null,
      optional: getModifierKind(compilerNode.questionToken),
      readonly: getModifierKind(compilerNode.readonlyToken),
    };
  }
  if (TypeNode.isTypeLiteralNode(node)) {
    return {
      kind: "object",
      members: getObjectMembers(node),
    };
  }

  if (TypeNode.isFunctionTypeNode(node)) {
    const returnTypeNode = node.getReturnTypeNode();
    return {
      kind: "signature",
      parameters: getParameters(node),
      typeParams: getTypeParameters(node),
      returnType: returnTypeNode
        ? convertTypeNode(returnTypeNode)
        : _convertType(node.getReturnType(), 0),
    };
  }

  if (TypeNode.isConstructorTypeNode(node)) {
    const returnTypeNode = node.getReturnTypeNode();
    return {
      kind: "constructor",
      parameters: getParameters(node),
      typeParams: [],
      returnType: returnTypeNode
        ? convertTypeNode(returnTypeNode)
        : _convertType(node.getReturnType(), 0),
    };
  }

  if (ts.isArrayTypeNode(compilerNode)) {
    return {
      kind: "array",
      readonly: false,
      inner: convertTypeNode(wrapInTsMorphNode(node, compilerNode.elementType)),
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
              ? "variadic"
              : element.questionToken
              ? "optional"
              : "required",
            label: element.name.text,
            type: convertTypeNode(wrapInTsMorphNode(node, element.type)),
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
          kind = "variadic";
        }
        return {
          kind,
          label: null,
          type: convertTypeNode(wrapInTsMorphNode(node, innerType)),
        };
      }),
    };
  }

  if (ts.isTypeOperatorNode(compilerNode)) {
    if (compilerNode.operator === ts.SyntaxKind.UniqueKeyword) {
      return { kind: "intrinsic", value: "unique symbol" };
    }
    if (compilerNode.operator === ts.SyntaxKind.ReadonlyKeyword) {
      const inner = convertTypeNode(wrapInTsMorphNode(node, compilerNode.type));
      if (inner.kind === "array" || inner.kind === "tuple") {
        return {
          ...inner,
          readonly: true,
        };
      }
      assert(
        false,
        `non-array thing with readonly keyword with kind: ${inner.kind}`
      );
    }
    if (compilerNode.operator === ts.SyntaxKind.KeyOfKeyword) {
      return {
        kind: "keyof",
        value: convertTypeNode(wrapInTsMorphNode(node, compilerNode.type)),
      };
    }
    assertNever(compilerNode.operator);
  }

  if (TypeNode.isImportTypeNode(node)) {
    let qualifier = node.getQualifier();
    if (qualifier) {
      return handleReference(node.getTypeArguments(), qualifier);
    }
    return _convertType(node.getType(), 0);
  }

  if (ts.isTypeQueryNode(compilerNode)) {
    const entityName = wrapInTsMorphNode(node, compilerNode.exprName);
    let symbol = entityName.getSymbol();
    if (symbol) {
      symbol = symbol.getAliasedSymbol() || symbol;

      return {
        kind: "typeof",
        fullName: getSymbolIdentifier(symbol),
        name: symbol.getName(),
      };
    }
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
        ? { type: convertTypeNode(wrapInTsMorphNode(node, compilerNode.type)) }
        : {}),
    };
  }

  if (ts.isTemplateLiteralTypeNode(compilerNode)) {
    compilerNode.head;
    return {
      kind: "template",
      head: compilerNode.head.text,
      rest: compilerNode.templateSpans.map((element) => {
        return {
          type: convertTypeNode(wrapInTsMorphNode(node, element.type)),
          text: element.literal.text,
        };
      }),
    };
  }

  return {
    kind: "raw",
    value: compilerNode.getText(),
    tsKind: ts.SyntaxKind[compilerNode.kind],
  };
}
