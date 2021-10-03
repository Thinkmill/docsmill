import { createProject } from "@ts-morph/bootstrap";
import { assert } from "./lib/assert";
import path from "path";
import { getDocsInfo } from "./extract";

export async function getInfo(filename: string) {
  let project = await createProject({
    tsConfigFilePath: "./tsconfig.json",
  });
  const sourceFile = project.getSourceFileOrThrow(path.resolve(filename));
  const program = project.createProgram();
  const rootSymbol = program.getTypeChecker().getSymbolAtLocation(sourceFile);
  assert(rootSymbol !== undefined);
  const rootSymbols = new Map([[rootSymbol, "test"]]);
  return getDocsInfo(rootSymbols, ".", "test", "0.0.0", program);
}
