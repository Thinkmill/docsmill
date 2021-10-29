import { SerializedDeclaration, SymbolId } from "../lib/types";

export function getSymbolsForInnerBit(
  accessibleSymbols: Record<string, SerializedDeclaration[]>,
  canonicalExportLocations: {
    [key: SymbolId]: readonly [exportName: string, fileSymbolId: SymbolId];
  },
  symbolReferences: Record<SymbolId, SymbolId[]>,
  _rootSymbols: SymbolId[]
): {
  unexportedToExportedRef: Map<SymbolId, SymbolId>;
  symbolsForInnerBit: Record<SymbolId, SymbolId[]>;
} {
  const unexportedToExportedRef = new Map<SymbolId, SymbolId>();
  const unexportedToUnexportedRef = new Map<SymbolId, SymbolId>();

  for (const [_symbolFullName, symbols] of Object.entries(symbolReferences)) {
    const symbolFullName = _symbolFullName as SymbolId;
    if (
      !canonicalExportLocations[symbolFullName] &&
      accessibleSymbols[symbolFullName] &&
      accessibleSymbols[symbolFullName][0].kind !== "enum-member"
    ) {
      const firstExportedSymbol = symbols.find(
        (x) => canonicalExportLocations[x] !== undefined
      );
      if (firstExportedSymbol) {
        unexportedToExportedRef.set(symbolFullName, firstExportedSymbol);
      } else {
        unexportedToUnexportedRef.set(symbolFullName, symbols[0]);
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
