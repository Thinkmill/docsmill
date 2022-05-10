export type SymbolId = string & { __symbolIdTag: any };

export type TypeParam<Docs> = {
  name: string;
  constraint: SerializedType<Docs> | null;
  default: SerializedType<Docs> | null;
};

export type Parameter<Docs> = {
  name: string;
  type: SerializedType<Docs>;
  kind: "optional" | "rest" | "normal";
};

export type SimpleSerializedDeclaration<Docs> =
  | {
      kind: "function";
      name: string;
      parameters?: [Parameter<Docs>, ...Parameter<Docs>[]];
      docs: Docs;
      typeParams?: [TypeParam<Docs>, ...TypeParam<Docs>[]];
      returnType: SerializedType<Docs>;
    }
  | {
      kind: "variable";
      name: string;
      docs: Docs;
      variableKind: "var" | "let" | "const";
      type: SerializedType<Docs>;
    }
  | {
      kind: "type-alias";
      name: string;
      docs: Docs;
      typeParams?: [TypeParam<Docs>, ...TypeParam<Docs>[]];
      type: SerializedType<Docs>;
    }
  | {
      kind: "unknown";
      name: string;
      docs: Docs;
      content: string;
    }
  | {
      kind: "interface";
      name: string;
      docs: Docs;
      typeParams?: [TypeParam<Docs>, ...TypeParam<Docs>[]];
      extends?: [SerializedType<Docs>, ...SerializedType<Docs>[]];
      members?: [ObjectMember<Docs>, ...ObjectMember<Docs>[]];
    }
  | {
      kind: "class";
      name: string;
      docs: Docs;
      willBeComparedNominally: boolean;
      typeParams?: [TypeParam<Docs>, ...TypeParam<Docs>[]];
      extends: SerializedType<Docs> | null;
      implements?: [SerializedType<Docs>, ...SerializedType<Docs>[]];
      constructors?: [
        ConstructorDeclaration<Docs>,
        ...ConstructorDeclaration<Docs>[]
      ];
      members?: [ClassMember<Docs>, ...ClassMember<Docs>[]];
    };

export type ConstructorDeclaration<Docs> = {
  parameters?: [Parameter<Docs>, ...Parameter<Docs>[]];
  docs: Docs;
};

export type SerializedDeclaration<Docs> =
  | SimpleSerializedDeclaration<Docs>
  | {
      kind: "module";
      name: string;
      docs: Docs;
      exports: Record<string, SymbolId>;
    }
  | {
      kind: "namespace";
      name: string;
      docs: Docs;
      exports: Record<string, SymbolId>;
    }
  | {
      kind: "enum";
      const: boolean;
      name: string;
      docs: Docs;
      members: SymbolId[];
    }
  | {
      kind: "enum-member";
      name: string;
      docs: Docs;
      value: string | number | null;
    };

export type ClassMember<Docs> =
  | {
      kind: "index";
      static: boolean;
      key: SerializedType<Docs>;
      value: SerializedType<Docs>;
    }
  | {
      kind: "prop";
      static: boolean;
      name: string;
      docs: Docs;
      optional: boolean;
      readonly: boolean;
      type: SerializedType<Docs>;
    }
  | ({
      kind: "method";
      static: boolean;
      name: string;
      docs: Docs;
      optional: boolean;
    } & FunctionLike<Docs>)
  | {
      kind: "unknown";
      content: string;
    };

export type TupleElement<Docs> = {
  label: string | null;
  kind: "optional" | "required" | "rest";
  type: SerializedType<Docs>;
};

type FunctionLike<Docs> = {
  parameters?: [Parameter<Docs>, ...Parameter<Docs>[]];
  typeParams?: [TypeParam<Docs>, ...TypeParam<Docs>[]];
  returnType: SerializedType<Docs>;
};

export type ObjectMember<Docs> =
  | {
      kind: "index";
      docs: Docs;
      readonly: boolean;
      key: SerializedType<Docs>;
      value: SerializedType<Docs>;
    }
  | {
      kind: "prop";
      name: string;
      docs: Docs;
      optional: boolean;
      readonly: boolean;
      type: SerializedType<Docs>;
    }
  | ({
      kind: "method";
      name: string;
      docs: Docs;
      optional: boolean;
    } & FunctionLike<Docs>)
  | ({
      kind: "constructor" | "call";
      docs: Docs;
    } & FunctionLike<Docs>)
  | {
      kind: "unknown";
      content: string;
    };

export type SerializedType<Docs> =
  | { kind: "intrinsic"; value: string }
  | {
      kind: "reference";
      id: SymbolId;
      name: string;
      typeArguments?: [SerializedType<Docs>, ...SerializedType<Docs>[]];
    }
  | { kind: "typeof"; id: SymbolId; name: string }
  | { kind: "array"; readonly: boolean; inner: SerializedType<Docs> }
  | { kind: "type-parameter"; name: string }
  | { kind: "union"; types: SerializedType<Docs>[] }
  | { kind: "intersection"; types: SerializedType<Docs>[] }
  | { kind: "infer"; name: string }
  | { kind: "paren"; value: SerializedType<Docs> }
  | {
      kind: "tuple";
      readonly: boolean;
      elements?: [TupleElement<Docs>, ...TupleElement<Docs>[]];
    }
  | { kind: "object"; members?: [ObjectMember<Docs>, ...ObjectMember<Docs>[]] }
  | {
      kind: "indexed-access";
      object: SerializedType<Docs>;
      index: SerializedType<Docs>;
    }
  | {
      kind: "conditional";
      checkType: SerializedType<Docs>;
      extendsType: SerializedType<Docs>;
      trueType: SerializedType<Docs>;
      falseType: SerializedType<Docs>;
    }
  | { kind: "string-literal"; value: string }
  | { kind: "numeric-literal"; value: string }
  | { kind: "prefix-unary"; operator: string; value: string }
  | { kind: "bigint-literal"; value: string }
  | { kind: "keyof"; value: SerializedType<Docs> }
  | {
      kind: "mapped";
      param: { name: string; constraint: SerializedType<Docs> };
      type: SerializedType<Docs>;
      as: SerializedType<Docs> | null;
      readonly: -1 | 0 | 1;
      optional: -1 | 0 | 1;
    }
  | ({ kind: "signature" } & FunctionLike<Docs>)
  | ({
      kind: "constructor";
    } & FunctionLike<Docs>)
  | {
      kind: "type-predicate";
      asserts: boolean;
      param: string;
      /** This can be optional for `asserts condition` where `condition` is a param */
      type?: SerializedType<Docs>;
    }
  | {
      kind: "template";
      head: string;
      rest?: [
        { type: SerializedType<Docs>; text: string },
        ...{ type: SerializedType<Docs>; text: string }[]
      ];
    }
  | { kind: "raw"; value: string };
