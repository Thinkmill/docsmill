import { createContext, useContext } from "react";
import { SerializedDeclaration, SymbolId } from "./types";

export type DocsContextType<Docs = unknown> = {
  symbols: Record<SymbolId, SerializedDeclaration<Docs>[]>;
  references: Record<SymbolId, SymbolId[]>;
  canonicalExportLocations: Record<
    SymbolId,
    { exportName: string; parent: SymbolId }
  >;
  symbolsForInnerBit: Map<SymbolId, SymbolId[]>;
  goodIdentifiers: Record<SymbolId, string>;
  rootSymbols: Set<SymbolId>;
  externalSymbols: Record<
    SymbolId,
    { pkg: string; version: string; id: string }
  >;
  locations: Record<
    SymbolId,
    { file: string; line: number; src?: { file: string; line: number } }[]
  >;
};

export const DocsContext = createContext<DocsContextType>(null as any);

export function useDocsContext() {
  return useContext(DocsContext);
}
