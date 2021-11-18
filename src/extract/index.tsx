import { ts } from "./ts";
import { applyCanonicalExportNames, findCanonicalExportInfo } from "./exports";
import { getSymbolIdentifier } from "./core/utils";
import { SerializedDeclaration, SymbolId } from "../lib/types";
import { combinePaths } from "./path";
import { getSymbolsForInnerBit } from "./symbols-for-inner-bit";
import {
  getCoreDocsInfo,
  getCoreDocsInfoWithoutSimpleDeclarations,
} from "./core";
import { getGoodIdentifiers } from "./good-identifiers";
import { getDocsImpl } from "./get-docs-impl";

export type DocInfo = {
  packageName: string;
  rootSymbols: SymbolId[];
  accessibleSymbols: { [key: SymbolId]: SerializedDeclaration<string>[] };
  symbolReferences: { [key: SymbolId]: SymbolId[] };
  canonicalExportLocations: { [k: SymbolId]: SymbolId };
  goodIdentifiers: Record<SymbolId, string>;
  symbolsForInnerBit: Record<SymbolId, SymbolId[]>;
  externalSymbols: Record<
    SymbolId,
    { pkg: string; version: string; id: string }
  >;
  versions?: string[];
  currentVersion: string;
  locations: Record<
    SymbolId,
    { file: string; line: number; src?: { file: string; line: number } }[]
  >;
};

export function getIsExternalSymbolForPkg(pkgDir: string) {
  const pkgDirNodeModules = combinePaths(pkgDir, "node_modules");
  return (symbol: ts.Symbol) => {
    const decl = symbol.declarations![0];
    const sourceFile = decl.getSourceFile();
    if (
      !sourceFile.fileName.includes(pkgDir) ||
      sourceFile.fileName.includes(pkgDirNodeModules)
    ) {
      return true;
    }
    return false;
  };
}

export function getShouldIncludeDeclForPkg(pkgDir: string) {
  const pkgDirNodeModules = combinePaths(pkgDir, "node_modules");
  return (node: ts.Node) => {
    const sourceFile = node.getSourceFile();
    if (
      !sourceFile.fileName.includes(pkgDir) ||
      sourceFile.fileName.includes(pkgDirNodeModules)
    ) {
      return false;
    }
    return true;
  };
}

export function getDocsInfo(
  rootSymbols: Map<ts.Symbol, string>,
  pkgDir: string,
  packageName: string,
  currentVersion: string,
  program: ts.Program,
  getExternalReference: (
    symbol: ts.Symbol,
    symbolId: SymbolId
  ) => { pkg: string; version: string; id: string } | undefined = () =>
    undefined,
  getSrcMapping: (
    distFilename: string,
    line: number
  ) => { file: string; line: number } | undefined = () => undefined
): DocInfo {
  const { accessibleSymbols, externalSymbols, symbolReferences } =
    getCoreDocsInfo(
      rootSymbols,
      program,
      getIsExternalSymbolForPkg(pkgDir),
      getShouldIncludeDeclForPkg(pkgDir),
      (node) => getDocsImpl(node, { program })
    );

  const baseInfo = {
    packageName,
    currentVersion,
    rootSymbols: [...rootSymbols.keys()].map((symbol) =>
      getSymbolIdentifier(symbol)
    ),
    accessibleSymbols: Object.fromEntries(
      [...accessibleSymbols].map(([symbol, rootThing]) => [
        getSymbolIdentifier(symbol),
        rootThing,
      ])
    ),
    symbolReferences: Object.fromEntries(
      [...symbolReferences].map(([symbol, symbolsThatReferenceIt]) => {
        return [
          getSymbolIdentifier(symbol),
          [...symbolsThatReferenceIt].map((x) => getSymbolIdentifier(x)),
        ];
      })
    ),
    locations: Object.fromEntries(
      [...accessibleSymbols].map(([symbol]) => {
        return [
          getSymbolIdentifier(symbol),
          symbol.declarations!.map((decl) => {
            const sourceFile = decl.getSourceFile();
            const fileName = sourceFile.fileName;
            const line = sourceFile.getLineAndCharacterOfPosition(
              (decl as any).name?.pos ?? decl.pos
            ).line;
            const src = getSrcMapping(fileName, line);
            return {
              file: fileName.replace(pkgDir, ""),
              line,
              ...(src ? { src } : {}),
            };
          }),
        ];
      })
    ),
  };

  const serializedExternalSymbols: DocInfo["externalSymbols"] = {};
  for (const x of externalSymbols) {
    const symbolId = getSymbolIdentifier(x);
    const ref = getExternalReference(x, symbolId);
    if (ref) {
      serializedExternalSymbols[symbolId] = ref;
    }
  }
  const canonicalExportLocations = findCanonicalExportInfo(
    baseInfo.rootSymbols,
    baseInfo.accessibleSymbols
  );

  baseInfo.accessibleSymbols = applyCanonicalExportNames(
    baseInfo.accessibleSymbols,
    canonicalExportLocations.names
  );

  const innerBit = getSymbolsForInnerBit(
    baseInfo.accessibleSymbols,
    canonicalExportLocations.locations,
    baseInfo.symbolReferences,
    baseInfo.rootSymbols
  );

  return {
    ...baseInfo,
    symbolsForInnerBit: innerBit.symbolsForInnerBit,
    goodIdentifiers: getGoodIdentifiers(
      baseInfo.accessibleSymbols,
      packageName,
      canonicalExportLocations.locations,
      innerBit,
      baseInfo.rootSymbols
    ),
    externalSymbols: serializedExternalSymbols,
    canonicalExportLocations: canonicalExportLocations.locations,
  };
}

export type DepDocInfo = { goodIdentifiers: Record<SymbolId, string> };

export function getDocsInfoForDep(
  rootSymbols: Map<ts.Symbol, string>,
  pkgDir: string,
  packageName: string,
  program: ts.Program
): DepDocInfo {
  const coreDocsInfo = getCoreDocsInfoWithoutSimpleDeclarations(
    rootSymbols,
    program,
    getIsExternalSymbolForPkg(pkgDir)
  );
  const rootSymbolIds = [...rootSymbols.keys()].map((x) =>
    getSymbolIdentifier(x)
  );
  let accessibleSymbols = Object.fromEntries(
    [...coreDocsInfo.accessibleSymbols].map(([symbol, rootThing]) => [
      getSymbolIdentifier(symbol),
      rootThing,
    ])
  );
  const canonicalExportInfo = findCanonicalExportInfo(
    rootSymbolIds,
    accessibleSymbols
  );
  accessibleSymbols = applyCanonicalExportNames(
    accessibleSymbols,
    canonicalExportInfo.names
  );
  const goodIdentifiers = getGoodIdentifiers(
    accessibleSymbols,
    packageName,
    canonicalExportInfo.locations,
    { symbolsForInnerBit: {}, unexportedToExportedRef: new Map() },
    rootSymbolIds
  );
  return { goodIdentifiers };
}
