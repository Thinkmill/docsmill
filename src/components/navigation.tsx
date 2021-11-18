/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import { useDocsContext } from "../lib/DocsContext";
import { SymbolReference } from "./symbol-references";
import { getGroupedExports } from "../lib/utils";
import { nonRootSymbolReference } from "./symbol-references.css";
import { assert } from "../lib/assert";
import { Expandable, Item } from "./expandable";
import { SymbolId } from "../lib/types";

export function Navigation({ rootSymbolName }: { rootSymbolName: SymbolId }) {
  const docContext = useDocsContext();
  const decls = docContext.symbols[rootSymbolName].filter(
    (x): x is Extract<typeof x, { kind: "module" | "namespace" }> =>
      x.kind === "module" || x.kind === "namespace"
  );
  assert(
    decls.length >= 1,
    "symbols in Navigation must be modules or namespaces"
  );
  const groupedExports = getGroupedExports(rootSymbolName, docContext);
  let name = decls[0].name;

  return (
    <Expandable summary={<SymbolReference id={rootSymbolName} name={name} />}>
      <ul css={{ padding: 0 }}>
        {groupedExports.map(function ExportGroup(group, i) {
          if (group.kind !== "canonical") {
            return (
              <Item key={i}>
                <a
                  css={nonRootSymbolReference}
                  href={`#${docContext.goodIdentifiers[rootSymbolName]}-re-exports-${i}`}
                >
                  {group.exports.length} Re-exports
                </a>
              </Item>
            );
          }
          return (
            <NavigationItem
              key={i}
              name={group.exportName}
              symbolId={group.fullName}
            />
          );
        })}
      </ul>
    </Expandable>
  );
}

export function NavigationItem({
  symbolId,
  name,
}: {
  symbolId: SymbolId;
  name: string;
}) {
  const docContext = useDocsContext();
  const decls = docContext.symbols[symbolId];
  if (decls.some((x) => x.kind === "module" || x.kind === "namespace")) {
    return <Navigation rootSymbolName={symbolId} />;
  }
  return (
    <Item>
      <SymbolReference id={symbolId} name={name} />
    </Item>
  );
}
