import { SerializedDeclaration, SymbolId } from "../lib/types";

type ExportName = string;

type Symbols = Record<
  SymbolId,
  [SerializedDeclaration, ...SerializedDeclaration[]]
>;

function collectImportableSymbolLocationsFromRootSymbols(
  rootSymbols: SymbolId[],
  accessibleSymbols: Symbols
) {
  const state = new Map<SymbolId, Map<SymbolId, ExportName>>();
  const queue = new Set(rootSymbols);
  for (const moduleSymbolId of queue) {
    const moduleSymbolDecls = accessibleSymbols[moduleSymbolId];
    for (const moduleSymbolDecl of moduleSymbolDecls) {
      if (
        moduleSymbolDecl.kind !== "module" &&
        moduleSymbolDecl.kind !== "namespace"
      ) {
        continue;
      }

      for (const [exportName, symbolId] of Object.entries(
        moduleSymbolDecl.exports
      )) {
        if (symbolId === 0) continue;
        const exportedDecls = accessibleSymbols[symbolId];
        if (!exportedDecls) continue;
        if (!state.has(symbolId)) {
          state.set(symbolId, new Map());
        }
        const exportLocations = state.get(symbolId)!;
        exportLocations.set(moduleSymbolId, exportName);
        queue.add(symbolId);
      }
    }
  }
  return state;
}

export function findCanonicalExportLocations(
  rootSymbols: SymbolId[],
  accessibleSymbols: Symbols
): Record<SymbolId, [ExportName, SymbolId]> {
  const state = collectImportableSymbolLocationsFromRootSymbols(
    rootSymbols,
    accessibleSymbols
  );

  const result: Record<SymbolId, [ExportName, SymbolId]> = {};
  for (const [symbol, exportLocations] of state) {
    let current: [SymbolId, string] | undefined;
    for (const val of exportLocations) {
      if (!current) {
        current = val;
      }
      const valDecl = accessibleSymbols[val[0]][0];
      const currentDecl = accessibleSymbols[current[0]][0];
      if (
        valDecl.kind === "module" &&
        (currentDecl.kind !== "module" || valDecl.name < currentDecl.name)
      ) {
        current = val;
      }
    }
    result[symbol] = [current![1], current![0]];
  }

  return result;
}
