import { ts, Type } from "ts-morph";
import { getProject } from ".";
import { assert } from "../lib/assert";
import { SerializedType } from "../lib/types";
import { convertTypeNode } from "./convert-node";

export function wrapInTsMorphType(someType: Type, compilerType: ts.Type) {
  return (someType as any)._context.compilerFactory.getType(compilerType);
}

export function convertType(type: ts.Type | Type): SerializedType {
  const compilerNode = getProject()
    .getTypeChecker()
    .compilerObject.typeToTypeNode(
      (type as any).compilerType
        ? ((type as any).compilerType as ts.Type)
        : (type as ts.Type),
      undefined,
      ts.NodeBuilderFlags.NoTruncation
    );
  assert(compilerNode !== undefined);
  return convertTypeNode(compilerNode);
}
