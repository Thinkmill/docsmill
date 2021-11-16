export type SymbolId = string & { __symbolIdTag: any };

export type TypeParam = {
  name: string;
  constraint: SerializedType | null;
  default: SerializedType | null;
};

export type Parameter = {
  name: string;
  type: SerializedType;
  kind: "optional" | "rest" | "normal";
};

export type SerializedDeclaration =
  | {
      kind: "function";
      name: string;
      parameters: Parameter[];
      docs: string;
      typeParams: TypeParam[];
      returnType: SerializedType;
    }
  | {
      kind: "module";
      name: string;
      docs: string;
      exports: Record<string, SymbolId | 0>;
    }
  | {
      kind: "variable";
      name: string;
      docs: string;
      variableKind: "var" | "let" | "const";
      type: SerializedType;
    }
  | {
      kind: "type-alias";
      name: string;
      docs: string;
      typeParams: TypeParam[];
      type: SerializedType;
    }
  | {
      kind: "unknown";
      name: string;
      docs: string;
      content: string;
    }
  | {
      kind: "interface";
      name: string;
      docs: string;
      typeParams: TypeParam[];
      extends: SerializedType[];
      members: ObjectMember[];
    }
  | {
      kind: "class";
      name: string;
      docs: string;
      willBeComparedNominally: boolean;
      typeParams: TypeParam[];
      extends: SerializedType | null;
      implements: SerializedType[];
      constructors: {
        parameters: Parameter[];
        docs: string;
      }[];
      members: ClassMember[];
    }
  | {
      kind: "enum";
      const: boolean;
      name: string;
      docs: string;
      members: SymbolId[];
    }
  | {
      kind: "enum-member";
      name: string;
      docs: string;
      value: string | number | null;
    }
  | {
      kind: "namespace";
      name: string;
      docs: string;
      exports: Record<string, SymbolId | 0>;
    };

export type ClassMember =
  | {
      kind: "index";
      static: boolean;
      key: SerializedType;
      value: SerializedType;
    }
  | {
      kind: "prop";
      static: boolean;
      name: string;
      docs: string;
      optional: boolean;
      readonly: boolean;
      type: SerializedType;
    }
  | ({
      kind: "method";
      static: boolean;
      name: string;
      docs: string;
      optional: boolean;
    } & FunctionLike)
  | {
      kind: "unknown";
      content: string;
    };

export type TupleElement = {
  label: string | null;
  kind: "optional" | "required" | "rest";
  type: SerializedType;
};

type FunctionLike = {
  parameters: Parameter[];
  typeParams: TypeParam[];
  returnType: SerializedType;
};

export type ObjectMember =
  | {
      kind: "index";
      docs: string;
      readonly: boolean;
      key: SerializedType;
      value: SerializedType;
    }
  | {
      kind: "prop";
      name: string;
      docs: string;
      optional: boolean;
      readonly: boolean;
      type: SerializedType;
    }
  | ({
      kind: "method";
      name: string;
      docs: string;
      optional: boolean;
    } & FunctionLike)
  | ({
      kind: "constructor" | "call";
      docs: string;
    } & FunctionLike)
  | {
      kind: "unknown";
      content: string;
    };

export type SerializedType =
  | { kind: "intrinsic"; value: string }
  | {
      kind: "reference";
      fullName: SymbolId;
      name: string;
      typeArguments: SerializedType[];
    }
  | {
      kind: "typeof";
      fullName: SymbolId;
      name: string;
    }
  | { kind: "array"; readonly: boolean; inner: SerializedType }
  | { kind: "type-parameter"; name: string }
  | { kind: "union"; types: SerializedType[] }
  | { kind: "intersection"; types: SerializedType[] }
  | { kind: "infer"; name: string }
  | { kind: "paren"; value: SerializedType }
  | { kind: "tuple"; readonly: boolean; elements: TupleElement[] }
  | { kind: "object"; members: ObjectMember[] }
  | { kind: "indexed-access"; object: SerializedType; index: SerializedType }
  | {
      kind: "conditional";
      checkType: SerializedType;
      extendsType: SerializedType;
      trueType: SerializedType;
      falseType: SerializedType;
    }
  | { kind: "string-literal"; value: string }
  | { kind: "numeric-literal"; value: number }
  | { kind: "bigint-literal"; value: string }
  | { kind: "keyof"; value: SerializedType }
  | {
      kind: "mapped";
      param: { name: string; constraint: SerializedType };
      type: SerializedType;
      as: SerializedType | null;
      readonly: -1 | 0 | 1;
      optional: -1 | 0 | 1;
    }
  | {
      kind: "signature";
      parameters: Parameter[];
      typeParams: TypeParam[];
      returnType: SerializedType;
    }
  | {
      kind: "constructor";
      parameters: Parameter[];
      typeParams: TypeParam[];
      returnType: SerializedType;
    }
  | {
      kind: "type-predicate";
      asserts: boolean;
      param: string;
      /** This can be optional for `asserts condition` where `condition` is a param */
      type?: SerializedType;
    }
  | {
      kind: "template";
      head: string;
      rest: { type: SerializedType; text: string }[];
    }
  | { kind: "raw"; value: string };
