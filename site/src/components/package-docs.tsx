/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from "@emotion/react";

import { DocsContext, DocsContextType } from "../lib/DocsContext";

import { RenderRootSymbol, RenderSymbolInfo } from "./symbol";
import { NavigationItem } from "./navigation";
import { Contents, NavigationContainer, PageContainer } from "./layout";

import { SymbolReference } from "./symbol-references";
import { objectEntriesAssumeNoExcessProps } from "../lib/utils";
import { Components } from "./core/type";
import { Docs } from "./docs";
import { PackageHeader } from "./package-header";

const components: Components<import("hast").Content[]> = {
  Docs,
  SymbolReference,
};

export function PackageDocs(props: import("../npm").PackageDocInfo) {
  const renderSymbolInfo: RenderSymbolInfo = {
    symbolsForInnerBit: new Map(
      objectEntriesAssumeNoExcessProps(props.symbolsForInnerBit)
    ),
    references: props.symbolReferences,
    locations: props.locations,
  };

  const docInfo: DocsContextType<import("hast").Content[]> = {
    symbols: props.symbols,
    canonicalExportLocations: props.canonicalExportLocations,
    goodIdentifiers: props.goodIdentifiers,
    externalSymbols: props.externalSymbols,
    rootSymbols: new Set(props.rootSymbols),
  };

  return (
    <DocsContext.Provider value={docInfo}>
      <PackageHeader
        packageName={props.packageName}
        version={props.version}
        versions={props.versions}
      />
      <PageContainer>
        <NavigationContainer>
          <ul css={{ margin: 0, padding: 0 }}>
            {props.rootSymbols.map((rootSymbol) => (
              <NavigationItem
                key={rootSymbol}
                symbolId={rootSymbol}
                name={props.symbols[rootSymbol][0].name}
              />
            ))}
          </ul>
        </NavigationContainer>
        <Contents>
          {props.rootSymbols.map((rootSymbol) => (
            <RenderRootSymbol
              key={rootSymbol}
              symbol={rootSymbol}
              docInfo={docInfo}
              components={components}
              renderSymbolInfo={renderSymbolInfo}
              isExported={false}
            />
          ))}
        </Contents>
      </PageContainer>
    </DocsContext.Provider>
  );
}
