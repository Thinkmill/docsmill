import { SerializedDeclaration, SymbolId } from "../lib/types";
import { objectEntriesAssumeNoExcessProps } from "../lib/utils";

export function getSymbolsForInnerBit(
  accessibleSymbols: Record<string, SerializedDeclaration<unknown>[]>,
  canonicalExportLocations: {
    [key: SymbolId]: readonly [exportName: string, fileSymbolId: SymbolId];
  },
  symbolReferences: Record<SymbolId, SymbolId[]>,
  _rootSymbols: SymbolId[]
): {
  unexportedToExportedRef: Map<SymbolId, SymbolId>;
  symbolsForInnerBit: Record<SymbolId, SymbolId[]>;
} {
  const rootSymbols = new Set(_rootSymbols);
  const unexportedToExportedRef = new Map<SymbolId, SymbolId>();
  const unexportedToUnexportedRef = new Map<SymbolId, SymbolId>();

  for (const [symbolId, symbols] of objectEntriesAssumeNoExcessProps(
    symbolReferences
  )) {
    if (
      !canonicalExportLocations[symbolId] &&
      !rootSymbols.has(symbolId) &&
      accessibleSymbols[symbolId] &&
      accessibleSymbols[symbolId][0].kind !== "enum-member"
    ) {
      const firstExportedSymbol = symbols.find(
        (x) => canonicalExportLocations[x] !== undefined
      );
      if (firstExportedSymbol) {
        unexportedToExportedRef.set(symbolId, firstExportedSymbol);
      } else {
        unexportedToUnexportedRef.set(symbolId, symbols[0]);
      }
    }
  }

  while (unexportedToUnexportedRef.size) {
    for (const [
      unexportedSymbol,
      unexportedReferencedLocation,
    ] of unexportedToUnexportedRef) {
      if (unexportedToExportedRef.has(unexportedReferencedLocation)) {
        unexportedToUnexportedRef.delete(unexportedSymbol);
        unexportedToExportedRef.set(
          unexportedSymbol,
          unexportedToExportedRef.get(unexportedReferencedLocation)!
        );
      }
      if (unexportedToUnexportedRef.has(unexportedReferencedLocation)) {
        unexportedToUnexportedRef.set(
          unexportedSymbol,
          unexportedToUnexportedRef.get(unexportedReferencedLocation)!
        );
      }
    }
  }
  const symbolsForInnerBit: Record<SymbolId, SymbolId[]> = {};
  for (const [unexported, exported] of unexportedToExportedRef) {
    if (symbolsForInnerBit[exported] === undefined) {
      symbolsForInnerBit[exported] = [];
    }
    symbolsForInnerBit[exported].push(unexported);
  }
  return { unexportedToExportedRef, symbolsForInnerBit };
}
