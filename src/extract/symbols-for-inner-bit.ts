import assert from "assert";
import { SerializedDeclaration, SymbolId } from "../lib/types";

export function getSymbolsForInnerBitsAndGoodIdentifiers(
  accessibleSymbols: Record<string, SerializedDeclaration[]>,
  packageName: string,
  canonicalExportLocations: {
    [key: SymbolId]: readonly [exportName: string, fileSymbolId: SymbolId];
  },
  symbolReferences: Record<SymbolId, SymbolId[]>,
  _rootSymbols: SymbolId[]
) {
  const rootSymbols = new Set(_rootSymbols);
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
  const symbolsForInnerBit = new Map<SymbolId, SymbolId[]>();

  for (const [unexported, exported] of unexportedToExportedRef) {
    if (!symbolsForInnerBit.has(exported)) {
      symbolsForInnerBit.set(exported, []);
    }
    symbolsForInnerBit.get(exported)!.push(unexported);
  }

  const goodIdentifiers: Record<string, string> = {};

  const findIdentifier = (symbol: SymbolId): string => {
    if (rootSymbols.has(symbol)) {
      const name = accessibleSymbols[symbol][0].name;
      if (name === packageName) {
        return "/";
      }
      return name.replace(packageName, "");
    }
    const canon = canonicalExportLocations[symbol];
    assert(!!canon);
    const [exportName, parent] = canon;
    return `${findIdentifier(parent)}.${exportName}`;
  };

  for (const [_symbolId, [symbol]] of Object.entries(accessibleSymbols)) {
    const symbolId = _symbolId as SymbolId;
    if (symbol.kind == "enum-member") continue;
    if (rootSymbols.has(symbolId)) {
      goodIdentifiers[symbolId] = symbol.name;
    } else if (canonicalExportLocations[symbolId]) {
      goodIdentifiers[symbolId] = findIdentifier(symbolId);
    } else {
      const exportedSymbol = unexportedToExportedRef.get(symbolId)!;
      assert(exportedSymbol !== undefined);
      const symbolsShownInUnexportedBit =
        symbolsForInnerBit.get(exportedSymbol)!;
      const innerThings = symbolsShownInUnexportedBit.filter(
        (x) => accessibleSymbols[x][0].name === symbol.name
      );
      const identifier = `${findIdentifier(exportedSymbol)}.${symbol.name}`;
      if (innerThings.length === 1) {
        goodIdentifiers[symbolId] = identifier;
      } else {
        const index = innerThings.indexOf(symbolId);
        goodIdentifiers[symbolId] = `${identifier}-${index}`;
      }
    }
    if (symbol.kind === "enum") {
      for (const childSymbolId of symbol.members) {
        goodIdentifiers[
          childSymbolId
        ] = `${goodIdentifiers[symbolId]}.${accessibleSymbols[childSymbolId][0].name}`;
      }
    }
  }
  return {
    goodIdentifiers,
    symbolsForInnerBit: Object.fromEntries(symbolsForInnerBit),
  };
}
