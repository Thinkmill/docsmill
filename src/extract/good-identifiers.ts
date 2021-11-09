import { assert } from "../lib/assert";
import { SerializedDeclaration, SymbolId } from "../lib/types";
import { objectEntriesAssumeNoExcessProps } from "../lib/utils";

export function getGoodIdentifiers(
  accessibleSymbols: Record<SymbolId, SerializedDeclaration[]>,
  packageName: string,
  canonicalExportLocations: {
    [key: SymbolId]: readonly [exportName: string, fileSymbolId: SymbolId];
  },
  {
    symbolsForInnerBit,
    unexportedToExportedRef,
  }: {
    unexportedToExportedRef: Map<SymbolId, SymbolId>;
    symbolsForInnerBit: Record<SymbolId, SymbolId[]>;
  },
  _rootSymbols: SymbolId[]
) {
  const rootSymbols = new Set(_rootSymbols);

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

  for (const [symbolId, [symbol]] of objectEntriesAssumeNoExcessProps(
    accessibleSymbols
  )) {
    if (symbol.kind == "enum-member") continue;
    if (rootSymbols.has(symbolId)) {
      goodIdentifiers[symbolId] = symbol.name;
    } else if (canonicalExportLocations[symbolId]) {
      goodIdentifiers[symbolId] = findIdentifier(symbolId);
    } else {
      const exportedSymbol = unexportedToExportedRef.get(symbolId)!;
      assert(exportedSymbol !== undefined);
      const symbolsShownInUnexportedBit = symbolsForInnerBit[exportedSymbol];
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
  return goodIdentifiers;
}
