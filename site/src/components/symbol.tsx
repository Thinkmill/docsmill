/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from "@emotion/react";
import { Fragment } from "react";
import { DocsContextType } from "../lib/DocsContext";
import { AddNameToScope, SymbolReference } from "./symbol-references";
import * as styles from "./symbol.css";
import { SymbolId } from "@docsmill/types";
import Link from "next/link";
import { useRouter } from "next/router";
import { getPkgWithVersionPortionOfParms } from "../npm/params";
import { Declaration } from "./declaration";
import { Components } from "../components/core";

export type RenderSymbolInfo = {
  symbolsForInnerBit: Map<SymbolId, SymbolId[]>;
  references: Record<SymbolId, SymbolId[]>;
  locations: Record<
    SymbolId,
    { file: string; line: number; src?: { file: string; line: number } }[]
  >;
};

export function RenderRootSymbol<Docs>({
  symbol,
  docInfo,
  components,
  renderSymbolInfo,
  isExported,
}: {
  symbol: SymbolId;
  docInfo: DocsContextType<Docs>;
  components: Components<Docs>;
  renderSymbolInfo: RenderSymbolInfo;
  isExported: boolean;
}) {
  const { references, locations } = renderSymbolInfo;
  const { goodIdentifiers, symbols } = docInfo;
  let decls = symbols[symbol];
  const relatedSymbols = (references[symbol] || []).filter((thing) =>
    symbols[thing].some((x) => x.kind !== "module" && x.kind !== "namespace")
  );
  const innerBits = renderSymbolInfo.symbolsForInnerBit.get(symbol);
  const locationsForSymbol = locations[symbol];
  const router = useRouter();
  const pkgRefPortion = router.query.pkg
    ? getPkgWithVersionPortionOfParms(router.query.pkg)
    : undefined;

  return (
    <div>
      <div css={{ display: "flex", justifyContent: "space-between" }}>
        <a css={styles.symbolHeadingLink} href={`#${goodIdentifiers[symbol]}`}>
          <h3
            css={
              decls[0].kind === "module"
                ? styles.moduleHeading
                : styles.symbolHeading
            }
            id={goodIdentifiers[symbol]}
          >
            {decls[0].name}
          </h3>
        </a>
        {pkgRefPortion !== undefined && (
          <div css={{ display: "flex", gap: 4 }}>
            {locationsForSymbol.map((location, i) => (
              <Fragment key={i}>
                <Link
                  href={`/src/${pkgRefPortion}${location.file}#L${
                    location.line + 1
                  }`}
                >
                  decl
                </Link>
                {location.src && (
                  <Link
                    href={`/src/${pkgRefPortion}${location.src.file}#L${
                      location.src.line + 1
                    }`}
                  >
                    source
                  </Link>
                )}
              </Fragment>
            ))}
          </div>
        )}
      </div>
      <div css={styles.rootSymbolContainer}>
        <AddNameToScope name={decls[0].name} fullName={symbol}>
          {decls.map((decl, i) => {
            return (
              <div key={i}>
                <components.Docs docs={decl.docs} />
                <Declaration
                  components={components}
                  fullName={symbol}
                  isExported={isExported}
                  decl={decl}
                  docInfo={docInfo}
                  renderSymbolInfo={renderSymbolInfo}
                />
              </div>
            );
          })}
        </AddNameToScope>
      </div>
      {!!relatedSymbols?.length && (
        <details css={innerBits ? undefined : styles.referencesContainer}>
          <summary>Referenced by</summary>
          <ul css={styles.referenceList}>
            {relatedSymbols.map(function ReferenceItem(thing, i) {
              return (
                <li key={i} css={styles.referenceItem}>
                  <SymbolReference id={thing} name={symbols[thing][0].name} />
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {innerBits && (
        <details css={styles.referencesContainer}>
          <summary>Unexported symbols referenced here</summary>
          {innerBits.map((thing) => {
            return (
              <RenderRootSymbol
                key={thing}
                symbol={thing}
                docInfo={docInfo}
                components={components}
                renderSymbolInfo={renderSymbolInfo}
                isExported={false}
              />
            );
          })}
        </details>
      )}
    </div>
  );
}
