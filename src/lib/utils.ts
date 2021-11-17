import { SerializedDeclaration, SymbolId } from "./types";
import { DocsContextType } from "./DocsContext";

export const objectEntriesAssumeNoExcessProps: <T>(
  o: T
) => { [Key in keyof T]: [Key, T[Key]] }[keyof T][] = Object.entries;

type TransformedExport =
  | {
      kind: "external-exports";
      from: string;
      version: string;
      exports: {
        name: string;
        id: string;
      }[];
    }
  | {
      kind: "unknown-exports";
      exports: string[];
    }
  | {
      kind: "exports";
      from: SymbolId;
      exports: {
        sourceName: string;
        localName: string;
        fullName: SymbolId;
      }[];
    }
  | { kind: "canonical"; exportName: string; fullName: SymbolId };

export function getGroupedExports(
  fullName: SymbolId,
  {
    symbols,
    canonicalExportLocations,
    externalSymbols,
  }: DocsContextType<unknown>
) {
  const decls = symbols[fullName].filter(
    (x): x is Extract<typeof x, { kind: "module" | "namespace" }> =>
      x.kind === "module" || x.kind === "namespace"
  );
  const transformedExports: TransformedExport[] = [];

  for (const rootThing of decls) {
    for (const [exportName, exportedSymbol] of objectEntriesAssumeNoExcessProps(
      rootThing.exports
    )) {
      const _prev = transformedExports[transformedExports.length - 1];
      const prev: typeof _prev | undefined = _prev;
      if (
        !symbols[exportedSymbol] ||
        !canonicalExportLocations[exportedSymbol]
      ) {
        const external = externalSymbols[exportedSymbol];
        if (!external) {
          if (prev?.kind === "unknown-exports") {
            prev.exports.push(exportName);
            continue;
          }
          transformedExports.push({
            kind: "unknown-exports",
            exports: [exportName],
          });
          continue;
        }
        const exported = {
          name: exportName,
          id: externalSymbols[exportedSymbol].id,
        };
        if (
          prev?.kind === "external-exports" &&
          prev.from === external.pkg &&
          prev.version === external.version
        ) {
          prev.exports.push(exported);
          continue;
        }
        transformedExports.push({
          kind: "external-exports",
          from: external.pkg,
          version: external.version,
          exports: [exported],
        });
        continue;
      }
      const canonicalLocation = canonicalExportLocations[exportedSymbol];
      if (
        canonicalLocation &&
        canonicalLocation.exportName === exportName &&
        canonicalLocation.parent === fullName
      ) {
        transformedExports.push({
          kind: "canonical",
          exportName,
          fullName: exportedSymbol,
        });
        continue;
      }
      if (prev?.kind === "exports") {
        if (prev.from === canonicalLocation.parent) {
          prev.exports.push({
            localName: exportName,
            sourceName: canonicalLocation.exportName,
            fullName: exportedSymbol,
          });
          continue;
        }
        const prevSymbol = symbols[prev.from][0] as Extract<
          SerializedDeclaration<unknown>,
          { kind: "module" }
        >;
        if (prevSymbol) {
          const potentialExport = objectEntriesAssumeNoExcessProps(
            prevSymbol.exports
          ).find(([, symbolId]) => symbolId === exportedSymbol);
          if (potentialExport) {
            prev.exports.push({
              localName: exportName,
              sourceName: potentialExport[0],
              fullName: exportedSymbol,
            });
            continue;
          }
        }
      }
      transformedExports.push({
        kind: "exports",
        from: canonicalLocation.parent,
        exports: [
          {
            localName: exportName,
            sourceName: canonicalLocation.exportName,
            fullName: exportedSymbol,
          },
        ],
      });
    }
  }
  return transformedExports;
}

export function splitDocs(docs: string): {
  first: string;
  rest: string | undefined;
} {
  const [, first, rest] = /(^[^]+?)\r?\n\r?\n([^]+)/.exec(docs) || [
    "",
    docs,
    "",
  ];
  return {
    first,
    rest: rest || undefined,
  };
}
