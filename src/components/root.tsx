/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import { useEffect, useMemo, useState } from "react";

import { DocsContext } from "../lib/DocsContext";

import { RenderRootSymbol } from "../components/symbol";
import { NavigationItem } from "../components/navigation";
import {
  Contents,
  Header,
  NavigationContainer,
  PageContainer,
} from "../components/layout";

import { useRouter } from "next/router";
import * as styles from "./root.css";
import { ChevronDown } from "./icons/chevron-down";
import { getExternalPackageUrl, SymbolReference } from "./symbol-references";
import { objectEntriesAssumeNoExcessProps } from "../lib/utils";
import { Components } from "./core/type";
import { Docs } from "./docs";

function openParentDetails(element: HTMLElement) {
  if (element instanceof HTMLDetailsElement) {
    element.open = true;
  }
  if (element.parentElement) {
    openParentDetails(element.parentElement);
  }
}

const components: Components<string> = { Docs, SymbolReference };

export function Root(props: import("../extract").DocInfo) {
  const router = useRouter();
  const [versionState, setVersionState] = useState({
    fromCurrentProps: props.currentVersion,
    current: props.currentVersion,
  });
  if (props.currentVersion !== versionState.fromCurrentProps) {
    setVersionState({
      current: props.currentVersion,
      fromCurrentProps: props.currentVersion,
    });
  }
  useEffect(() => {
    let handler = () => {
      const hash = window.location.hash.replace("#", "");
      const element = document.getElementById(hash);
      if (element) {
        openParentDetails(element);
        element.scrollIntoView();
      }
    };
    window.addEventListener("hashchange", handler, false);
    handler();
    return () => {
      window.removeEventListener("hashchange", handler);
    };
  }, []);

  const docInfo = {
    symbols: props.accessibleSymbols,
    references: props.symbolReferences,
    canonicalExportLocations: useMemo(
      () =>
        Object.fromEntries(
          objectEntriesAssumeNoExcessProps(props.canonicalExportLocations).map(
            ([key, [exportName, parent]]) =>
              [key, { exportName, parent }] as const
          )
        ),
      [props.canonicalExportLocations]
    ),
    symbolsForInnerBit: new Map(
      objectEntriesAssumeNoExcessProps(props.symbolsForInnerBit)
    ),
    goodIdentifiers: props.goodIdentifiers,
    rootSymbols: new Set(props.rootSymbols),
    externalSymbols: props.externalSymbols,
    locations: props.locations,
  };

  return (
    <DocsContext.Provider value={docInfo}>
      <Header packageName={props.packageName} />
      <PageContainer>
        <NavigationContainer>
          {props.versions && (
            <span css={styles.versionSelectWrapper}>
              <select
                css={styles.versionSelect}
                onChange={(event) => {
                  const newVersion = event.target.value;
                  router.push({
                    pathname: getExternalPackageUrl(
                      props.packageName,
                      newVersion
                    ),
                    hash: window.location.hash,
                  });
                  setVersionState((x) => ({ ...x, current: newVersion }));
                }}
                value={versionState.current}
                disabled={
                  versionState.current !== versionState.fromCurrentProps
                }
              >
                {props.versions.map((version) => (
                  <option key={version}>{version}</option>
                ))}
              </select>
              <ChevronDown height="20px" css={styles.versionSelectChevron} />
            </span>
          )}

          {versionState.current !== versionState.fromCurrentProps && (
            <span aria-label="Loading new version">⏳</span>
          )}

          <ul css={{ margin: 0, padding: 0 }}>
            {props.rootSymbols.map((rootSymbol) => (
              <NavigationItem
                key={rootSymbol}
                symbolId={rootSymbol}
                name={props.accessibleSymbols[rootSymbol][0].name}
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
            />
          ))}
        </Contents>
      </PageContainer>
    </DocsContext.Provider>
  );
}
