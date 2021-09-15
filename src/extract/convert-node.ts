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

function wrapInTsMorphNode<LocalCompilerNodeType extends ts.Node = ts.Node>(
  someNode: Node,
  compilerNode: LocalCompilerNodeType
): CompilerNodeToWrappedType<LocalCompilerNodeType> {
  return (someNode as any)._getNodeFromCompilerNode(compilerNode);
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
  if (TypeNode.isTypeReferenceNode(node)) {
    return handleReference(node.getTypeArguments(), node.getTypeName());
  }
  if (TypeNode.isExpressionWithTypeArguments(node)) {
    return handleReference(
      node.getTypeArguments(),
      node.getExpression() as EntityName
    );
  }
  const compilerNode = node.compilerNode;

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
  if (TypeNode.isUnionTypeNode(node)) {
    return {
      kind: "union",
      types: node.getTypeNodes().map((x) => convertTypeNode(x)),
    };
  }
  if (TypeNode.isIndexedAccessTypeNode(node)) {
    return {
      kind: "indexed-access",
      object: convertTypeNode(node.getObjectTypeNode()),
      index: convertTypeNode(node.getIndexTypeNode()),
    };
  }
  if (TypeNode.isConditionalTypeNode(node)) {
    return {
      kind: "conditional",
      checkType: convertTypeNode(node.getCheckType()),
      extendsType: convertTypeNode(node.getExtendsType()),
      trueType: convertTypeNode(node.getTrueType()),
      falseType: convertTypeNode(node.getFalseType()),
    };
  }
  if (TypeNode.isParenthesizedTypeNode(node)) {
    return { kind: "paren", value: convertTypeNode(node.getTypeNode()) };
  }

  if (TypeNode.isInferTypeNode(node)) {
    return { kind: "infer", name: node.getTypeParameter().getName() };
  }
  if (TypeNode.isIntersectionTypeNode(node)) {
    return {
      kind: "intersection",
      types: node.getTypeNodes().map((x) => convertTypeNode(x)),
    };
  }
  if (TypeNode.isMappedTypeNode(node)) {
    const typeParam = node.getTypeParameter();
    const constraint = typeParam.getConstraintOrThrow();

    return {
      kind: "mapped",
      param: {
        name: typeParam.getName(),
        constraint: convertTypeNode(constraint),
      },
      type: convertTypeNode(node.getTypeNodeOrThrow()),
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

  if (TypeNode.isArrayTypeNode(node)) {
    return {
      kind: "array",
      readonly: false,
      inner: convertTypeNode(node.getElementTypeNode()),
    };
  }

  if (TypeNode.isTupleTypeNode(node)) {
    return {
      kind: "tuple",
      readonly: false,
      elements: node.getElements().map((element): TupleElement => {
        let label: string | null = null;
        if (TypeNode.isNamedTupleMember(element)) {
          label = element.getName();
          element = element.getTypeNode();
        }

        if (element.compilerNode.kind === ts.SyntaxKind.OptionalType) {
          fakeAssert<Node<ts.OptionalTypeNode>>(element);
          return {
            kind: "optional",
            label,
            type: convertTypeNode(element.getNodeProperty("type")),
          };
        }

        if (element.compilerNode.kind === ts.SyntaxKind.RestType) {
          fakeAssert<TypeNode<ts.RestTypeNode>>(element);
          return {
            kind: "variadic",
            label,
            type: convertTypeNode(element.getNodeProperty("type")),
          };
        }
        return {
          kind: "required",
          label,
          type: convertTypeNode(element),
        };
      }),
    };
  }

  if (node.compilerNode.kind === ts.SyntaxKind.TypeOperator) {
    fakeAssert<TypeNode<ts.TypeOperatorNode>>(node);
    if (node.compilerNode.operator === ts.SyntaxKind.UniqueKeyword) {
      return { kind: "intrinsic", value: "unique symbol" };
    }
    if (node.compilerNode.operator === ts.SyntaxKind.ReadonlyKeyword) {
      const inner = convertTypeNode(node.getNodeProperty("type"));
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
    if (node.compilerNode.operator === ts.SyntaxKind.KeyOfKeyword) {
      return {
        kind: "keyof",
        value: convertTypeNode(node.getNodeProperty("type")),
      };
    }
    assertNever(node.compilerNode.operator);
  }

  if (TypeNode.isImportTypeNode(node)) {
    let qualifier = node.getQualifier();
    if (qualifier) {
      return handleReference(node.getTypeArguments(), qualifier);
    }
    return _convertType(node.getType(), 0);
  }

  if (node.compilerNode.kind === ts.SyntaxKind.TypeQuery) {
    fakeAssert<TypeNode<ts.TypeQueryNode>>(node);
    const entityName = wrapInTsMorphNode(node, node.compilerNode.exprName);
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

  if (TypeNode.isTypePredicateNode(node)) {
    const typeNode = node.getTypeNode();
    return {
      kind: "type-predicate",
      asserts: node.hasAssertsModifier(),
      param: node.getParameterNameNode().getText(),
      type: typeNode ? convertTypeNode(typeNode) : typeNode,
    };
  }

  return {
    kind: "raw",
    value: compilerNode.getText(),
    tsKind: ts.SyntaxKind[compilerNode.kind],
  };
}
