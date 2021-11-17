/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import { Fragment } from "react";
import { useDocsContext } from "../lib/DocsContext";
import { SymbolReference } from "./symbol-references";
import * as styles from "./symbol.css";
import { SymbolId } from "../lib/types";
import Link from "next/link";
import { useRouter } from "next/router";
import { getPkgWithVersionPortionOfParms } from "../npm/params";
import { Declaration } from "./declaration";

export function RenderRootSymbol({ symbol }: { symbol: SymbolId }) {
  const {
    symbols,
    canonicalExportLocations,
    references,
    symbolsForInnerBit,
    locations,
    goodIdentifiers,
  } = useDocsContext();
  let decls = symbols[symbol];
  let isExported = false;
  if (canonicalExportLocations[symbol]) {
    isExported = true;
    const { exportName } = canonicalExportLocations[symbol];
    decls = decls.map((decl) => ({ ...decl, name: exportName }));
  }
  const relatedSymbols = (references[symbol] || []).filter((thing) =>
    symbols[thing].some((x) => x.kind !== "module" && x.kind !== "namespace")
  );
  const innerBits = symbolsForInnerBit.get(symbol);
  const locationsForSymbol = locations[symbol];
  const router = useRouter();
  const pkgRefPortion = router.query.pkg
    ? getPkgWithVersionPortionOfParms(router.query.pkg)
    : undefined;

  return (
    <div>
      <div css={{ display: "flex", justifyContent: "space-between" }}>
        {decls[0].kind === "module" ? (
          <h2 css={styles.moduleHeading}>{decls[0].name}</h2>
        ) : (
          <h3 css={styles.symbolHeading} id={goodIdentifiers[symbol]}>
            {decls[0].name}
          </h3>
        )}
        {pkgRefPortion !== undefined && (
          <div>
            {locationsForSymbol.map((location, i) => (
              <Fragment key={i}>
                <Link
                  href={`/src/${pkgRefPortion}${location.file}#L${
                    location.line + 1
                  }`}
                >
                  <a>[decl]</a>
                </Link>
                {location.src && (
                  <Link
                    href={`/src/${pkgRefPortion}${location.src.file}#L${
                      location.src.line + 1
                    }`}
                  >
                    <a>[src]</a>
                  </Link>
                )}
              </Fragment>
            ))}
          </div>
        )}
      </div>
      <div css={styles.rootSymbolContainer}>
        {decls.map((decl, i) => {
          return (
            <Declaration
              key={i}
              fullName={symbol}
              isExported={isExported}
              decl={decl}
            />
          );
        })}
      </div>
      {!!relatedSymbols?.length && (
        <details css={innerBits ? undefined : styles.referencesContainer}>
          <summary>Referenced by</summary>
          <ul css={styles.referenceList}>
            {relatedSymbols.map(function ReferenceItem(thing, i) {
              return (
                <li key={i} css={styles.referenceItem}>
                  <SymbolReference
                    fullName={thing}
                    name={symbols[thing][0].name}
                  />
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
            return <RenderRootSymbol key={thing} symbol={thing} />;
          })}
        </details>
      )}
    </div>
  );
}
