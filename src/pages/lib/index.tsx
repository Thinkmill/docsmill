/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import { SymbolFlags } from "typescript";
import { getDocsInfo } from "../../extract";
import { highlighterPromise } from "../../extract/markdown";
import { ts } from "../../extract/ts";
import { DocsContext, DocsContextType } from "../../lib/DocsContext";

import { RenderRootSymbol, RenderSymbolInfo } from "../../components/symbol";
import { NavigationItem } from "../../components/navigation";
import {
  Contents,
  Header,
  NavigationContainer,
  PageContainer,
} from "../../components/layout";

import { SymbolReference } from "../../components/symbol-references";
import { Components } from "../../components/core/type";
import { Docs } from "../../components/docs";

const components: Components<import("hast").Content[]> = {
  Docs,
  SymbolReference,
};

export default function Lib(props: import("../../extract").DocInfo) {
  const renderSymbolInfo: RenderSymbolInfo = {
    symbolsForInnerBit: new Map(),
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
      <Header packageName="lib" />
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

import { getFromTsConfig } from "../../local-extract";
import { assert } from "../../lib/assert";

export async function getStaticProps() {
  await highlighterPromise;

  const { compilerOptions, rootNames } = getFromTsConfig("./tsconfig.json");

  const host = ts.createCompilerHost(compilerOptions);

  const program = ts.createProgram({
    options: compilerOptions,
    rootNames,
    host,
  });

  const typeChecker = program.getTypeChecker();
  const globalThisSymbol: ts.Symbol = (typeChecker as any).resolveName(
    "globalThis",
    undefined,
    SymbolFlags.Module,
    false
  );

  const defaultLibLocation = host.getDefaultLibLocation!();

  const rootSymbols = new Map(
    [...(globalThisSymbol.exports as Map<string, ts.Symbol>).values()]
      .filter((x) =>
        x.declarations?.some((x) =>
          x.getSourceFile().fileName.includes(defaultLibLocation)
        )
      )
      .map((x) => [x, ""])
  );

  const docInfo = getDocsInfo(rootSymbols, defaultLibLocation, "lib", program);

  assert(
    Object.keys(docInfo.symbolsForInnerBit).length === 0,
    "expected all symbols to be publicly accessible"
  );

  return {
    props: docInfo,
  };
}
