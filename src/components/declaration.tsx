/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import { Fragment } from "react";
import { useDocsContext } from "../lib/DocsContext";
import { codeFont } from "../lib/theme.css";
import { SerializedDeclaration, SymbolId } from "../lib/types";
import { Docs } from "./docs";
import { Indent } from "./indent";
import {
  getExternalPackageUrl,
  getExternalSymbolUrl,
  SymbolReference,
} from "./symbol-references";
import { Syntax } from "./syntax";
import * as styles from "./symbol.css";
import { assert } from "../lib/assert";
import { useGroupedExports } from "../lib/utils";
import { RenderRootSymbol } from "./symbol";
import * as symbolReferenceStyles from "./symbol-references.css";
import Link from "next/link";
import { DeclarationName, SimpleDeclaration } from "./simple-declaration";
import { css } from "@emotion/react";

const enumMemberName = css(
  symbolReferenceStyles.nonRootSymbolReference,
  styles.targetBackground
);

export function Declaration({
  decl,
  isExported,
  fullName,
}: {
  decl: SerializedDeclaration;
  isExported: boolean;
  fullName: SymbolId;
}) {
  const { goodIdentifiers, symbols } = useDocsContext();

  if (decl.kind === "module") {
    return (
      <Fragment>
        <div css={styles.innerExportsHeading}>
          {isExported ? (
            <Fragment>
              <Syntax kind="keyword">export * as </Syntax>
              <DeclarationName name={decl.name} />
              <Syntax kind="keyword"> from</Syntax>
            </Fragment>
          ) : (
            <Fragment>
              <Syntax kind="keyword">module </Syntax>
              <a
                id={goodIdentifiers[fullName]}
                css={styles.moduleSpecifierLink}
                href={`#${goodIdentifiers[fullName]}`}
              >
                {JSON.stringify(decl.name)}
              </a>
            </Fragment>
          )}
          <Syntax kind="bracket">{" {"}</Syntax>
        </div>
        <Exports fullName={fullName} />

        <div css={styles.innerExportsCommon}>
          <Syntax kind="bracket">{"}"}</Syntax>
        </div>
      </Fragment>
    );
  }

  if (decl.kind === "unknown") {
    return (
      <Fragment>
        <DeclarationName name={decl.name} />
        <pre css={codeFont}>
          <code>{decl.content}</code>
        </pre>
      </Fragment>
    );
  }

  if (decl.kind === "enum") {
    const enumSymbol = decl;
    return (
      <Fragment>
        <Syntax kind="keyword">
          {isExported ? "export " : ""}
          {decl.const ? "const " : ""}
          enum{" "}
        </Syntax>
        <DeclarationName name={decl.name} />
        <Syntax kind="bracket">{" { "}</Syntax>
        {decl.members.map((memberId, i) => {
          const members = symbols[memberId];
          const member = members[0];
          assert(
            members.length === 1,
            "expected enum members to only contain a single enum member"
          );
          assert(
            member.kind === "enum-member",
            "expected enum to only contain enum members"
          );
          return (
            <Indent key={i}>
              <Docs content={member.docs} />
              <a
                id={goodIdentifiers[memberId]}
                href={`#${goodIdentifiers[memberId]}`}
                css={enumMemberName}
              >
                {member.name}
              </a>
              {member.value !== null && (
                <Fragment>
                  <Syntax kind="bracket">{" = "}</Syntax>
                  <Syntax kind="string">
                    {typeof member.value === "string"
                      ? JSON.stringify(member.value)
                      : member.value}
                  </Syntax>
                </Fragment>
              )}
              {i === enumSymbol.members.length - 1 ? null : (
                <Syntax kind="comma">{", "}</Syntax>
              )}
            </Indent>
          );
        })}
        <Syntax kind="bracket">{"}"}</Syntax>
      </Fragment>
    );
  }

  if (decl.kind === "namespace") {
    return (
      <Fragment>
        <div css={styles.innerExportsHeading}>
          <Syntax kind="keyword">
            {isExported ? "export " : ""}namespace{" "}
          </Syntax>
          <DeclarationName name={decl.name} />
          <Syntax kind="bracket">{" {"}</Syntax>
        </div>
        <Exports fullName={fullName} />
        <div css={styles.innerExportsCommon}>
          <Syntax kind="bracket">{"}"}</Syntax>
        </div>
      </Fragment>
    );
  }

  assert(
    decl.kind !== "enum-member",
    "unexpected enum member outside of enum declaration"
  );
  return <SimpleDeclaration decl={decl} isExported={isExported} />;
}

function Exports({ fullName }: { fullName: SymbolId }) {
  const { goodIdentifiers } = useDocsContext();
  const transformedExports = useGroupedExports(fullName);
  return (
    <div css={styles.innerExportsContainer}>
      {transformedExports.map(function Exported(exported, i) {
        if (exported.kind === "canonical") {
          return <RenderRootSymbol key={i} symbol={exported.fullName} />;
        }
        if (exported.kind === "unknown-exports") {
          return (
            <div
              key={i}
              id={goodIdentifiers[fullName] + `-re-exports-${i}`}
              css={styles.reexportTarget}
            >
              <Syntax kind="keyword">export</Syntax>
              <Syntax kind="bracket">{" { "}</Syntax>
              <Indent>
                {exported.exports.map((exportName) => {
                  return (
                    <div key={exportName}>
                      <SymbolReference
                        fullName={"unknown" as SymbolId}
                        name={exportName}
                      />
                      ,
                    </div>
                  );
                })}
              </Indent>
              <Syntax kind="bracket">{" } "}</Syntax>
              <Syntax kind="keyword">from </Syntax>
              <Syntax kind="string">"unknown"</Syntax>
            </div>
          );
        }
        if (exported.kind === "external-exports") {
          return (
            <div
              key={i}
              id={goodIdentifiers[fullName] + `-re-exports-${i}`}
              css={styles.reexportTarget}
            >
              <Syntax kind="keyword">export</Syntax>
              <Syntax kind="bracket">{" { "}</Syntax>
              <Indent>
                {exported.exports.map(function ReexportedItem(exportInfo, i) {
                  return (
                    <div key={i}>
                      <Link
                        href={getExternalSymbolUrl({
                          id: exportInfo.id,
                          pkg: exported.from,
                          version: exported.version,
                        })}
                      >
                        <a css={symbolReferenceStyles.nonRootSymbolReference}>
                          {exportInfo.name}
                        </a>
                      </Link>
                      ,
                    </div>
                  );
                })}
              </Indent>
              <Syntax kind="bracket">{" } "}</Syntax>
              <Syntax kind="keyword">from </Syntax>
              <Link
                href={getExternalPackageUrl(exported.from, exported.version)}
              >
                <a css={symbolReferenceStyles.rootSymbolReference}>
                  {JSON.stringify(exported.from)}
                </a>
              </Link>
            </div>
          );
        }
        return (
          <div
            key={i}
            id={goodIdentifiers[fullName] + `-re-exports-${i}`}
            css={styles.reexportTarget}
          >
            <Syntax kind="keyword">export</Syntax>
            <Syntax kind="bracket">{" { "}</Syntax>
            <Indent>
              {exported.exports.map((x, i) => {
                if (x.localName === x.sourceName) {
                  return (
                    <div key={i}>
                      <SymbolReference
                        fullName={x.fullName}
                        name={x.localName}
                      />
                      ,
                    </div>
                  );
                }

                return (
                  <div key={i}>
                    <SymbolReference
                      fullName={x.fullName}
                      name={x.sourceName}
                    />
                    <Syntax kind="keyword"> as </Syntax>
                    <SymbolReference fullName={x.fullName} name={x.localName} />
                    ,
                  </div>
                );
              })}
            </Indent>
            <Syntax kind="bracket">{" } "}</Syntax>
            <Syntax kind="keyword">from </Syntax>
            <ExportedFrom fullName={exported.from} />
          </div>
        );
      })}
    </div>
  );
}

function ExportedFrom({ fullName }: { fullName: SymbolId }) {
  const docContext = useDocsContext();
  if (docContext.rootSymbols.has(fullName)) {
    return (
      <SymbolReference
        fullName={fullName}
        name={docContext.symbols[fullName][0].name}
      />
    );
  }
  const { exportName, parent } = docContext.canonicalExportLocations[fullName];
  return (
    <Fragment>
      <ExportedFrom fullName={parent} />.
      <SymbolReference fullName={fullName} name={exportName} />
    </Fragment>
  );
}
