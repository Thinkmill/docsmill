import { createContext, useContext } from "react";
import { SerializedDeclaration, SymbolId } from "@docsmill/extract-core/types";

export type DocsContextType<Docs = unknown> = {
  symbols: Record<SymbolId, SerializedDeclaration<Docs>[]>;
  canonicalExportLocations: Record<SymbolId, SymbolId>;
  goodIdentifiers: Record<SymbolId, string>;
  externalSymbols: Record<
    SymbolId,
    { pkg: string; version: string; id: string }
  >;
  rootSymbols: Set<SymbolId>;
};

export const DocsContext = createContext<DocsContextType>(null as any);

export function useDocsContext() {
  return useContext(DocsContext);
}
