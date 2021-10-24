/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import { Fragment } from "react";

import { useDocsContext } from "../lib/DocsContext";
import { codeFont } from "../lib/theme.css";
import { useGroupedExports } from "../lib/utils";
import { assert } from "../lib/assert";
import { Docs } from "./docs";
import {
  SymbolName,
  SymbolReference,
  AddNameToScope,
  getExternalPackageUrl,
  getExternalSymbolUrl,
} from "./symbol-references";
import { Params, Type, TypeParams } from "./type";

import * as styles from "./symbol.css";
import {
  ClassMember,
  Parameter,
  SerializedDeclaration,
  SymbolId,
  TypeParam,
} from "../lib/types";
import { Syntax } from "./syntax";
import { Indent } from "./indent";
import * as symbolReferenceStyles from "./symbol-references.css";
import { a } from "./markdown.css";
import Link from "next/link";
import { useRouter } from "next/router";
import { getPkgWithVersionPortionOfParms } from "../npm/params";

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

export function RenderRootSymbol({ fullName }: { fullName: SymbolId }) {
  const { symbols, canonicalExportLocations } = useDocsContext();
  let decls = symbols[fullName];
  let isExported = false;
  if (canonicalExportLocations[fullName]) {
    isExported = true;
    decls = decls.map((decl) => ({
      ...decl,
      name: canonicalExportLocations[fullName].exportName,
    }));
  }
  return (
    <div css={styles.rootSymbolContainer}>
      {decls.map((decl, i) => {
        return (
          <Declaration
            key={i}
            fullName={fullName}
            isExported={isExported}
            decl={decl}
          />
        );
      })}
    </div>
  );
}

function Declaration({
  decl,
  isExported,
  fullName,
}: {
  decl: SerializedDeclaration;
  isExported: boolean;
  fullName: SymbolId;
}) {
  const { goodIdentifiers, symbols } = useDocsContext();

  if (decl.kind === "function") {
    return (
      <div>
        <Docs content={decl.docs} />
        <Fragment>
          <Syntax kind="keyword">{isExported ? "export " : ""}function </Syntax>
          <SymbolName name={decl.name} fullName={fullName} />
          <TypeParams params={decl.typeParams} />
          <Params params={decl.parameters} />
          <Syntax kind="colon">: </Syntax>
          <Type type={decl.returnType} />
        </Fragment>
      </div>
    );
  }
  if (decl.kind === "module") {
    return (
      <div>
        {isExported ? (
          <Docs content={decl.docs} />
        ) : (
          <Fragment>
            <h2 css={styles.moduleHeading}>{decl.name}</h2>
            <Docs content={decl.docs} />
          </Fragment>
        )}
        <div css={styles.innerExportsHeading}>
          {isExported ? (
            <Fragment>
              <Syntax kind="keyword">export * as </Syntax>
              <SymbolName name={decl.name} fullName={fullName} />
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
      </div>
    );
  }
  if (decl.kind === "variable") {
    return (
      <div>
        <Docs content={decl.docs} />
        <Fragment>
          <Syntax kind="keyword">
            {isExported ? "export " : ""}
            {decl.variableKind}{" "}
          </Syntax>
          <SymbolName name={decl.name} fullName={fullName} />
          <Syntax kind="colon">: </Syntax>
          <Type type={decl.type} />
          <Syntax kind="bracket">{" = "}</Syntax>
          <span css={codeFont}>...</span>
        </Fragment>
      </div>
    );
  }

  if (decl.kind === "unknown") {
    return (
      <div>
        <Docs content={decl.docs} />
        <SymbolName name={decl.name} fullName={fullName} />
        <pre css={codeFont}>
          <code>{decl.content}</code>
        </pre>
      </div>
    );
  }

  if (decl.kind === "interface") {
    const interfaceSymbol = decl;
    return (
      <div>
        <Docs content={decl.docs} />
        <Fragment>
          <Syntax kind="keyword">
            {isExported ? "export " : ""}
            interface{" "}
          </Syntax>
          <AddNameToScope name={decl.name} fullName={fullName}>
            <SymbolName name={decl.name} fullName={fullName} />
            <TypeParams params={decl.typeParams} />
            {!!decl.extends.length && (
              <Fragment>
                <Syntax kind="keyword"> extends </Syntax>
                {decl.extends.map((param, i) => {
                  return (
                    <Fragment key={i}>
                      <Type type={param} />
                      {i === interfaceSymbol.extends.length - 1 ? null : (
                        <Syntax kind="comma">{", "}</Syntax>
                      )}
                    </Fragment>
                  );
                })}
              </Fragment>
            )}
            <span css={codeFont}> </span>
            <Type type={{ kind: "object", members: decl.members }} />
          </AddNameToScope>
        </Fragment>
      </div>
    );
  }

  if (decl.kind === "class") {
    const classSymbol = decl;
    return (
      <div>
        <Docs content={decl.docs} />
        {decl.willBeComparedNominally && (
          <p>
            This class has private members, so it it will be compared nominally
            instead of structurally.{" "}
            <a
              css={a}
              href="https://www.typescriptlang.org/docs/handbook/type-compatibility.html#private-and-protected-members-in-classes"
            >
              See the TypeScript reference for more details.
            </a>
          </p>
        )}
        <Fragment>
          <Syntax kind="keyword">
            {isExported ? "export " : ""}
            class{" "}
          </Syntax>
          <AddNameToScope name={decl.name} fullName={fullName}>
            <SymbolName name={decl.name} fullName={fullName} />
            <TypeParams params={decl.typeParams} />
            {!!classSymbol.extends && (
              <Fragment>
                <Syntax kind="keyword"> extends </Syntax>
                <Type type={classSymbol.extends} />
              </Fragment>
            )}
            {!!decl.implements.length && (
              <Fragment>
                <Syntax kind="keyword"> implements </Syntax>
                {decl.implements.map((param, i) => {
                  return (
                    <Fragment key={i}>
                      <Type type={param} />
                      {i === classSymbol.implements.length - 1 ? null : (
                        <Syntax kind="comma">{", "}</Syntax>
                      )}
                    </Fragment>
                  );
                })}
              </Fragment>
            )}
            <span css={codeFont}> </span>
            <ClassMembers
              constructors={decl.constructors}
              members={decl.members}
            />
          </AddNameToScope>
        </Fragment>
      </div>
    );
  }

  if (decl.kind === "enum") {
    const enumSymbol = decl;
    return (
      <div>
        <Docs content={decl.docs} />
        <Fragment>
          <Syntax kind="keyword">
            {isExported ? "export " : ""}
            {decl.const ? "const " : ""}
            enum{" "}
          </Syntax>
          <SymbolName name={decl.name} fullName={fullName} />
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
                <SymbolName name={member.name} fullName={memberId} />
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
      </div>
    );
  }

  if (decl.kind === "namespace") {
    return (
      <div>
        <Docs content={decl.docs} />
        <div css={styles.innerExportsHeading}>
          <Syntax kind="keyword">
            {isExported ? "export " : ""}namespace{" "}
          </Syntax>
          <SymbolName name={decl.name} fullName={fullName} />
          <Syntax kind="bracket">{" {"}</Syntax>
        </div>
        <Exports fullName={fullName} />

        <div css={styles.innerExportsCommon}>
          <Syntax kind="bracket">{"}"}</Syntax>
        </div>
      </div>
    );
  }

  assert(
    decl.kind !== "enum-member",
    "unexpected enum member outside of enum declaration"
  );

  return (
    <div>
      <Docs content={decl.docs} />
      <Fragment>
        <Syntax kind="keyword">
          {isExported ? "export " : ""}
          type{" "}
        </Syntax>
        <AddNameToScope name={decl.name} fullName={fullName}>
          <SymbolName name={decl.name} fullName={fullName} />
          <TypeParams params={decl.typeParams} />
          <span css={codeFont}> = </span>
          <Type type={decl.type} />
        </AddNameToScope>
      </Fragment>
    </div>
  );
}

function ClassMembers({
  members,
  constructors,
}: {
  constructors: {
    parameters: Parameter[];
    docs: string;
    typeParams: TypeParam[];
  }[];
  members: ClassMember[];
}) {
  if (members.length === 0 && constructors.length === 0) {
    return <span css={codeFont}>{"{}"}</span>;
  }
  return (
    <Fragment>
      <span css={codeFont}>{"{ "}</span>
      {constructors.map((constructor, i) => {
        return (
          <Indent key={i}>
            <Docs content={constructor.docs} />
            <Syntax kind="keyword">constructor</Syntax>
            <TypeParams params={constructor.typeParams} />
            <Params params={constructor.parameters} />
          </Indent>
        );
      })}
      {members.map((prop, i) => {
        if (prop.kind === "prop") {
          return (
            <Indent key={i}>
              <Docs content={prop.docs} />
              {prop.readonly || prop.static ? (
                <Syntax kind="keyword">
                  {prop.static ? "static " : ""}
                  {prop.readonly ? "readonly " : ""}
                </Syntax>
              ) : null}
              <span css={codeFont}>{prop.name}</span>
              <Syntax kind="colon">{prop.optional ? "?: " : ": "}</Syntax>
              <Type type={prop.type} />
              <span css={codeFont}>;</span>
            </Indent>
          );
        }
        if (prop.kind === "index") {
          return (
            <Indent key={i}>
              <span css={codeFont}>
                [key<Syntax kind="colon">: </Syntax>
              </span>
              <Type type={prop.key} />
              <span css={codeFont}>]</span>
              <Syntax kind="colon">: </Syntax>
              <Type type={prop.value} />
              <span css={codeFont}>;</span>
            </Indent>
          );
        }
        if (prop.kind === "unknown") {
          return (
            <Indent key={i}>
              <span css={codeFont}>{prop.content}</span>
            </Indent>
          );
        }
        return (
          <Indent key={i}>
            <Docs content={prop.docs} />
            <span css={codeFont}>{prop.name}</span>
            <TypeParams params={prop.typeParams} />
            <Params params={prop.parameters} />
            <Syntax kind="colon">: </Syntax>
            <Type type={prop.returnType} />
            <span css={codeFont}>;</span>
          </Indent>
        );
      })}
      <span css={codeFont}>{" }"}</span>
    </Fragment>
  );
}

function Exports({ fullName }: { fullName: SymbolId }) {
  const {
    symbols,
    references,
    symbolsForInnerBit,
    goodIdentifiers,
    locations,
  } = useDocsContext();
  const transformedExports = useGroupedExports(fullName);
  const router = useRouter();
  const pkgRefPortion = router.query.pkg
    ? getPkgWithVersionPortionOfParms(router.query.pkg)
    : "unknown";
  return (
    <div css={styles.innerExportsContainer}>
      {transformedExports.map((exported, i) => {
        if (exported.kind === "canonical") {
          const { exportName, fullName: symbol } = exported;
          const relatedSymbols = (references[symbol] || []).filter((thing) =>
            symbols[thing].some(
              (x) => x.kind !== "module" && x.kind !== "namespace"
            )
          );
          const innerBits = symbolsForInnerBit.get(symbol);
          const locationsForSymbol = locations[symbol];
          return (
            <div key={i}>
              <div css={{ display: "flex", justifyContent: "space-between" }}>
                <h3 css={styles.symbolHeading} id={goodIdentifiers[symbol]}>
                  {exportName}
                </h3>
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
              </div>
              <RenderRootSymbol fullName={symbol} />
              {!!relatedSymbols?.length && (
                <details
                  css={innerBits ? undefined : styles.referencesContainer}
                >
                  <summary>Referenced by</summary>
                  <ul css={styles.referenceList}>
                    {relatedSymbols.map((thing, i) => {
                      return (
                        <li key={i} css={styles.referenceItem}>
                          <SymbolReference
                            key={i}
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
                    return (
                      <div key={thing}>
                        <RenderRootSymbol fullName={thing} />
                      </div>
                    );
                  })}
                </details>
              )}
            </div>
          );
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
                {exported.exports.map((exportInfo) => {
                  return (
                    <div key={exportInfo.name}>
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
