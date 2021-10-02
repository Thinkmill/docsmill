import { ts } from "./ts";
import { getTypeChecker } from ".";
import { assert } from "../lib/assert";
import { SerializedType } from "../lib/types";
import { convertTypeNode } from "./convert-node";

export function convertType(type: ts.Type): SerializedType {
  const compilerNode = getTypeChecker().typeToTypeNode(
    type,
    undefined,
    ts.NodeBuilderFlags.NoTruncation
  );
  assert(compilerNode !== undefined);
  return convertTypeNode(compilerNode);
}
