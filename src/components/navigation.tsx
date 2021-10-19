import { useDocsContext } from "../lib/DocsContext";
import { SymbolReference } from "./symbol-references";
import { useGroupedExports } from "../lib/utils";
import { nonRootSymbolReference } from "./symbol-references.css";
import { assert } from "../lib/assert";
import { Expandable, Item } from "./expandable";

export function Navigation({ rootSymbolName }: { rootSymbolName: string }) {
  const docContext = useDocsContext();
  const decls = docContext.symbols[rootSymbolName].filter(
    (x): x is Extract<typeof x, { kind: "module" | "namespace" }> =>
      x.kind === "module" || x.kind === "namespace"
  );
  assert(
    decls.length >= 1,
    "symbols in Navigation must be modules or namespaces"
  );
  const groupedExports = useGroupedExports(rootSymbolName);
  let name =
    docContext.canonicalExportLocations[rootSymbolName]?.exportName ??
    decls[0].name;

  return (
    <Expandable
      summary={<SymbolReference fullName={rootSymbolName} name={name} />}
    >
      <ul style={{ padding: 0 }}>
        {groupedExports.map((group, i) => {
          if (group.kind !== "canonical") {
            return (
              <Item key={i}>
                <a
                  className={nonRootSymbolReference}
                  href={`#${docContext.goodIdentifiers[rootSymbolName]}-re-exports-${i}`}
                >
                  {group.exports.length} Re-exports
                </a>
              </Item>
            );
          }
          const decls = docContext.symbols[group.fullName];
          if (
            decls.some((x) => x.kind === "module" || x.kind === "namespace")
          ) {
            return <Navigation key={i} rootSymbolName={group.fullName} />;
          }
          return (
            <Item key={i}>
              <SymbolReference
                fullName={group.fullName}
                name={group.exportName}
              />
            </Item>
          );
        })}
      </ul>
    </Expandable>
  );
}
