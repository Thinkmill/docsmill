import { SerializedDeclaration, SymbolId } from "@docsmill/extract-core/types";
import { objectEntriesAssumeNoExcessProps } from "../lib/utils";

type ExportName = string;

type Symbols<Docs> = Record<
  SymbolId,
  [SerializedDeclaration<Docs>, ...SerializedDeclaration<Docs>[]]
>;

function collectImportableSymbolLocationsFromRootSymbols(
  rootSymbols: SymbolId[],
  accessibleSymbols: Symbols<unknown>
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

      for (const [exportName, symbolId] of objectEntriesAssumeNoExcessProps(
        moduleSymbolDecl.exports
      )) {
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

export function findCanonicalExportInfo(
  rootSymbols: SymbolId[],
  accessibleSymbols: Symbols<unknown>
) {
  const state = collectImportableSymbolLocationsFromRootSymbols(
    rootSymbols,
    accessibleSymbols
  );

  const exportNames: Record<SymbolId, ExportName> = {};
  const allExportLocations: Record<SymbolId, SymbolId> = {};

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
    const [parent, exportName] = current!;
    exportNames[symbol] = exportName;
    allExportLocations[symbol] = parent;
  }

  return { names: exportNames, locations: allExportLocations };
}

export function applyCanonicalExportNames<Docs>(
  symbols: Symbols<Docs>,
  canonicalExportNames: Record<SymbolId, ExportName>
): Symbols<Docs> {
  const newSymbols: Symbols<Docs> = {};
  for (const [symbolId, decls] of objectEntriesAssumeNoExcessProps(symbols)) {
    const name = canonicalExportNames[symbolId];
    if (name !== undefined) {
      const newDecls = decls.map((decl) => ({ ...decl, name }));
      newSymbols[symbolId] = newDecls;
    } else {
      newSymbols[symbolId] = decls;
    }
  }
  return newSymbols;
}
