import { assert } from "../lib/assert";
import { SerializedDeclaration, SymbolId } from "@docsmill/extract-core/types";
import {
  objectEntriesAssumeNoExcessProps,
  objectKeysAssumeNoExcessProps,
} from "../lib/utils";

export function getGoodIdentifiersForExported(
  accessibleSymbols: Record<SymbolId, SerializedDeclaration<unknown>[]>,
  packageName: string,
  canonicalExportLocations: Record<SymbolId, SymbolId>,
  rootSymbols: SymbolId[]
) {
  const goodIdentifiers: Record<SymbolId, string> = {};
  const findIdentifier = (symbol: SymbolId): string => {
    const firstDecl = accessibleSymbols[symbol][0];
    const name = firstDecl.name;
    const parent = canonicalExportLocations[symbol];
    assert(parent !== undefined);
    return `${goodIdentifiers[parent] ?? findIdentifier(parent)}.${name}`;
  };
  for (const rootSymbolId of rootSymbols) {
    const firstDecl = accessibleSymbols[rootSymbolId][0];
    let name = firstDecl.name.replace(packageName, "");
    if (name === "") {
      name = "/";
    }
    goodIdentifiers[rootSymbolId] = name;
  }
  for (const symbolId of objectKeysAssumeNoExcessProps(
    canonicalExportLocations
  )) {
    const firstDecl = accessibleSymbols[symbolId][0];
    goodIdentifiers[symbolId] = findIdentifier(symbolId);
    if (firstDecl.kind === "enum") {
      for (const childSymbolId of firstDecl.members) {
        goodIdentifiers[
          childSymbolId
        ] = `${goodIdentifiers[symbolId]}.${accessibleSymbols[childSymbolId][0].name}`;
      }
    }
  }
  return goodIdentifiers;
}

export function getGoodIdentifiers(
  accessibleSymbols: Record<SymbolId, SerializedDeclaration<unknown>[]>,
  packageName: string,
  canonicalExportLocations: Record<SymbolId, SymbolId>,
  {
    symbolsForInnerBit,
    unexportedToExportedRef,
  }: {
    unexportedToExportedRef: Map<SymbolId, SymbolId>;
    symbolsForInnerBit: Record<SymbolId, SymbolId[]>;
  },
  rootSymbols: SymbolId[]
) {
  const goodIdentifiers = getGoodIdentifiersForExported(
    accessibleSymbols,
    packageName,
    canonicalExportLocations,
    rootSymbols
  );

  for (const [symbolId, [firstDecl]] of objectEntriesAssumeNoExcessProps(
    accessibleSymbols
  )) {
    if (firstDecl.kind === "enum-member") continue;
    if (goodIdentifiers[symbolId] === undefined) {
      const exportedSymbol = unexportedToExportedRef.get(symbolId)!;
      assert(exportedSymbol !== undefined);
      const symbolsShownInUnexportedBit = symbolsForInnerBit[exportedSymbol];
      const innerThings = symbolsShownInUnexportedBit.filter(
        (x) => accessibleSymbols[x][0].name === firstDecl.name
      );
      const identifier = `${goodIdentifiers[exportedSymbol]}.${firstDecl.name}`;
      if (innerThings.length === 1) {
        goodIdentifiers[symbolId] = identifier;
      } else {
        const index = innerThings.indexOf(symbolId);
        goodIdentifiers[symbolId] = `${identifier}-${index}`;
      }
      if (firstDecl.kind === "enum") {
        for (const childSymbolId of firstDecl.members) {
          goodIdentifiers[
            childSymbolId
          ] = `${goodIdentifiers[symbolId]}.${accessibleSymbols[childSymbolId][0].name}`;
        }
      }
    }
  }
  return goodIdentifiers;
}
