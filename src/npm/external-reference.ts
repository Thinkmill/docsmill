import ts from "typescript";
import { getDocsInfoForDep, getDocsInfo } from "../extract";
import { assert } from "../lib/assert";
import { SymbolId } from "../lib/types";
import { memoize } from "./utils";

export function getExternalReferenceHandler(
  program: ts.Program,
  resolvedDepsWithEntrypoints: Map<
    string,
    { entrypoints: Map<string, string>; pkgPath: string; version: string }
  >
) {
  const getFastDocInfo = memoize((pkgName: string) => {
    const { entrypoints, pkgPath, version } =
      resolvedDepsWithEntrypoints.get(pkgName)!;
    const rootSymbols = new Map<ts.Symbol, string>();
    for (const [entrypoint, resolved] of entrypoints) {
      const sourceFile = program.getSourceFile(resolved);
      if (sourceFile) {
        assert(
          sourceFile !== undefined,
          `expected to be able to get source file for ${resolved}`
        );
        const sourceFileSymbol = program
          .getTypeChecker()
          .getSymbolAtLocation(sourceFile);
        assert(sourceFileSymbol !== undefined);
        rootSymbols.set(sourceFileSymbol, entrypoint);
      }
    }
    return {
      info: getDocsInfoForDep(rootSymbols, pkgPath, pkgName, program),
      rootSymbols,
      pkgPath,
      version,
    };
  });
  const getCompleteDocInfo = memoize((pkgName: string) => {
    const { rootSymbols, pkgPath } = getFastDocInfo(pkgName);
    return getDocsInfo(
      rootSymbols,
      pkgPath,
      pkgName,
      program,
      undefined,
      undefined,
      false
    );
  });
  return (symbol: ts.Symbol, symbolId: SymbolId) => {
    const decl = symbol.declarations![0];
    const sourceFile = decl.getSourceFile();
    const match = sourceFile.fileName.match(
      /\/node_modules\/(@[^/]+\/[^/]+|[^/]+)/
    );
    if (match) {
      const pkgName = match[1];
      if (resolvedDepsWithEntrypoints.has(pkgName)) {
        const fastDocInfo = getFastDocInfo(pkgName);
        const identifierFromFast = fastDocInfo.info.goodIdentifiers[symbolId];
        if (identifierFromFast !== undefined) {
          return {
            id: identifierFromFast,
            pkg: pkgName,
            version: fastDocInfo.version,
          };
        }
        const docInfo = getCompleteDocInfo(pkgName);
        const identifierFromComplete = docInfo.goodIdentifiers[symbolId];
        if (identifierFromComplete !== undefined) {
          console.log(
            `deopted to get complete doc info for dep: ${pkgName} and found location: ${identifierFromComplete}`
          );
          return {
            id: identifierFromComplete,
            pkg: pkgName,
            version: fastDocInfo.version,
          };
        } else {
          console.log(
            `deopted to get complete doc info for dep: ${pkgName} but could not find location for symbol: ${symbol.getName()}\n${
              sourceFile.fileName
            }`
          );
        }
      }
    }
  };
}
