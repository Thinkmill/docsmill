export class Blah {
  blah() {}
  static staticBlah() {}
}

export namespace Blah {
  export type X = true;
}

export namespace Blah {
  export type Y = true;
  export const a = "something";
  export const { b, c } = { b: true, c: false };
}
