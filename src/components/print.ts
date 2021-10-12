import { SerializedType } from "../lib/types";

function indent(input: string, count: number): string {
  return input.replace(/^(?!\s*$)/gm, " ".repeat(count));
}

function printType(type: SerializedType) {
  if (type.kind === "array") {
    return `${type.readonly ? "readonly " : ""}${printType(type.inner)}[]`;
  }
  if (type.kind === "bigint-literal" || type.kind === "numeric-literal") {
    return `${type.value}`;
  }
  if (type.kind === "intrinsic") {
    return type.value;
  }
  if (type.kind === "string-literal") {
    return JSON.stringify(type.value);
  }
  if (type.kind === "raw") {
    return type.value;
  }
  if (type.kind === "union" || type.kind === "intersection") {
    const seperator = type.kind === "union" ? "|" : "&";
    if (type.types.length > 4) {
      return type.types.map((x) => {
        return;
        printType(x);
      });
    }
    return type.types.map((x) => printType(x)).join(` ${seperator} `);
  }
}
