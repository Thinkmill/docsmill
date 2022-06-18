export type InTypeParam<in T> = (x: T) => void;
export type OutTypeParam<out T> = () => T;
export type InOutTypeParam<in out T> = (x: T) => T;

export type InferExtends<T> = T extends [
  infer Head extends string,
  ...unknown[]
]
  ? Head
  : never;
