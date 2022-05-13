/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import { Fragment, useState } from "react";

import { DocsContext, DocsContextType } from "../lib/DocsContext";

import { RenderRootSymbol, RenderSymbolInfo } from "./symbol";
import { NavigationItem } from "./navigation";
import { Contents, Header, NavigationContainer, PageContainer } from "./layout";

import { useRouter } from "next/router";
import * as styles from "./package-docs.css";
import { ChevronDown } from "./icons/chevron-down";
import { getExternalPackageUrl, SymbolReference } from "./symbol-references";
import { objectEntriesAssumeNoExcessProps } from "../lib/utils";
import { Components } from "./core/type";
import { Docs } from "./docs";

const components: Components<import("hast").Content[]> = {
  Docs,
  SymbolReference,
};

function VersionSelect(props: {
  packageName: string;
  version: string;
  versions: string[];
}) {
  const router = useRouter();
  const [versionState, setVersionState] = useState({
    fromCurrentProps: props.version,
    current: props.version,
  });
  if (props.version !== versionState.fromCurrentProps) {
    setVersionState({
      current: props.version,
      fromCurrentProps: props.version,
    });
  }
  return (
    <Fragment>
      <span css={styles.versionSelectWrapper}>
        <select
          css={styles.versionSelect}
          onChange={(event) => {
            const newVersion = event.target.value;
            router.push({
              pathname: getExternalPackageUrl(props.packageName, newVersion),
              hash: window.location.hash,
            });
            setVersionState((x) => ({ ...x, current: newVersion }));
          }}
          value={versionState.current}
          disabled={versionState.current !== versionState.fromCurrentProps}
        >
          {props.versions.map((version) => (
            <option key={version}>{version}</option>
          ))}
        </select>
        <ChevronDown height="20px" css={styles.versionSelectChevron} />
      </span>
      {versionState.current !== versionState.fromCurrentProps && (
        <span aria-label="Loading new version">⏳</span>
      )}
    </Fragment>
  );
}

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
      <Header packageName={props.packageName} />
      <PageContainer>
        <NavigationContainer>
          <VersionSelect
            packageName={props.packageName}
            version={props.version}
            versions={props.versions}
          />
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
