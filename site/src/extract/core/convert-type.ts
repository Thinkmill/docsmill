import { ts } from "../ts";
import { ExtractionHost, getTypeChecker } from ".";
import { assert } from "../../lib/assert";
import { SerializedType } from "../../lib/types";
import { convertTypeNode } from "./convert-node";

export function convertType<Docs>(
  type: ts.Type,
  host: ExtractionHost<Docs>
): SerializedType<Docs> {
  const compilerNode = getTypeChecker(host).typeToTypeNode(
    type,
    undefined,
    ts.NodeBuilderFlags.NoTruncation
  );
  assert(compilerNode !== undefined);
  return convertTypeNode(compilerNode, host);
}
