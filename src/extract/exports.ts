import { ts } from "./ts";
import { assert } from "../lib/assert";
import { getExportedDeclarations } from "./get-exported-declarations";
import { getSymbolAtLocation } from "./utils";

type ExportName = string;

function collectImportableSymbolsFromModuledNode(
  moduleSymbol: ts.Symbol,
  state: Map<ts.Symbol, Map<ts.Symbol, ExportName>>
) {
  for (const [exportName, decls] of getExportedDeclarations(moduleSymbol)) {
    const decl = decls[0];
    if (!decl) {
      console.log(
        `no declarations for export ${exportName} in ${moduleSymbol.getName()}`
      );
      continue;
    }
    const symbol = getSymbolAtLocation(decl);

    assert(
      symbol !== undefined,
      "expected symbol to exist in exported declaration"
    );

    if (!state.has(symbol)) {
      state.set(symbol, new Map());
    }
    const exportLocations = state.get(symbol)!;
    exportLocations.set(moduleSymbol, exportName);
    for (const decl of decls) {
      if (
        ts.isSourceFile(decl) ||
        (ts.isModuleDeclaration(decl) &&
          ts.isIdentifier(decl.name) &&
          decl.body &&
          ts.isModuleBlock(decl.body))
      ) {
        // need to see if this can be circular
        const symbol = getSymbolAtLocation(decl);
        assert(
          symbol !== undefined,
          "expected symbol to exist in exported declaration"
        );
        collectImportableSymbolsFromModuledNode(symbol, state);
      }
    }
  }
}

export function findCanonicalExportLocations(
  rootSymbols: ts.Symbol[]
): Map<ts.Symbol, { parent: ts.Symbol; exportName: ExportName }> {
  const state = new Map<ts.Symbol, Map<ts.Symbol, ExportName>>();
  for (const rootSymbol of rootSymbols) {
    collectImportableSymbolsFromModuledNode(rootSymbol, state);
  }
  const map = new Map<
    ts.Symbol,
    { parent: ts.Symbol; exportName: ExportName }
  >();
  for (const [symbol, exportLocations] of state) {
    let current: [ts.Symbol, string] | undefined;
    for (const val of exportLocations) {
      if (!current) {
        current = val;
      }
      if (
        ts.isSourceFile(val[0].declarations![0]) &&
        (!ts.isSourceFile(current[0].declarations![0]) ||
          val[0].declarations![0].fileName.length <
            current[0].declarations![0].fileName.length)
      ) {
        current = val;
      }
    }
    const [parent, exportName] = current!;
    map.set(symbol, { parent, exportName });
  }

  return map;
}
