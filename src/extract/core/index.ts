import { ts } from "../ts";
import { SerializedDeclaration } from "../../lib/types";
import { convertDeclaration } from "../core/convert-declaration";
import { assert } from "../../lib/assert";
import { getSymbolIdentifier } from "./utils";

export type ExtractionHost = {
  referenceSymbol: (symbol: ts.Symbol) => void;
  program: ts.Program;
};

export function getTypeChecker(host: ExtractionHost): ts.TypeChecker {
  return host.program.getTypeChecker();
}

export function referenceSymbol(symbol: ts.Symbol, host: ExtractionHost) {
  assert(
    (symbol.flags & ts.SymbolFlags.AliasExcludes) === 0 &&
      (symbol as any).mergeId === undefined,
    "alias symbols cannot be passed to referenceSymbol"
  );
  host.referenceSymbol(symbol);
  return getSymbolIdentifier(symbol);
}

function collectSymbol(
  symbol: ts.Symbol,
  isExternalSymbol: (symbol: ts.Symbol) => boolean,
  referencedExternalSymbols: Set<ts.Symbol>,
  currentlyVistedSymbol: ts.Symbol | undefined,
  symbolReferences: Map<ts.Symbol, Set<ts.Symbol>>,
  symbolsQueue: Set<ts.Symbol>
) {
  if (!symbol.declarations?.length) {
    return;
  }
  if (isExternalSymbol(symbol)) {
    referencedExternalSymbols.add(symbol);
    return;
  }
  if (currentlyVistedSymbol !== undefined && symbol !== currentlyVistedSymbol) {
    if (!symbolReferences.has(symbol)) {
      symbolReferences.set(symbol, new Set());
    }
    const symbolsThatReferenceTheThing = symbolReferences.get(symbol)!;
    symbolsThatReferenceTheThing.add(currentlyVistedSymbol);
  }
  symbolsQueue.add(symbol);
}

export type CoreDocInfo = {
  accessibleSymbols: Map<
    ts.Symbol,
    [SerializedDeclaration, ...SerializedDeclaration[]]
  >;
  symbolReferences: Map<ts.Symbol, Set<ts.Symbol>>;
  externalSymbols: Set<ts.Symbol>;
};

export function getCoreDocsInfo(
  rootSymbols: Map<ts.Symbol, string>,
  program: ts.Program,
  isExternalSymbol: (symbol: ts.Symbol) => boolean,
  shouldIncludeDecl: (node: ts.Node) => boolean
): CoreDocInfo {
  const symbolsQueue = new Set<ts.Symbol>(rootSymbols.keys());
  const symbolReferences = new Map<ts.Symbol, Set<ts.Symbol>>();
  const externalSymbols = new Set<ts.Symbol>();
  let currentlyVistedSymbol: ts.Symbol | undefined;
  const host: ExtractionHost = {
    referenceSymbol: (symbol) =>
      collectSymbol(
        symbol,
        isExternalSymbol,
        externalSymbols,
        currentlyVistedSymbol,
        symbolReferences,
        symbolsQueue
      ),
    program,
  };
  const accessibleSymbols = new Map<
    ts.Symbol,
    [SerializedDeclaration, ...SerializedDeclaration[]]
  >();
  for (const symbol of symbolsQueue) {
    currentlyVistedSymbol = symbol;
    const decls = symbol.declarations;
    assert(
      decls !== undefined && decls.length >= 1,
      "symbols in symbol queue must have at least one declaration"
    );

    const nameReplacement = rootSymbols.get(symbol);

    const filteredDecls = decls
      .filter((decl) => shouldIncludeDecl(decl))
      .map((node) => {
        const decl = convertDeclaration(node, host);
        if (decl.kind === "module" && nameReplacement !== undefined) {
          return { ...decl, name: nameReplacement };
        }
        return decl;
      });
    if (filteredDecls.length === 0) {
      assert(
        false,
        `at least one decl must not be filtered out but all of the decls were filtered out:\n${decls
          .map((x) => `${x.getSourceFile().fileName}\n${x.getText()}`)
          .join("\n")}`
      );
    }

    accessibleSymbols.set(
      symbol,
      filteredDecls as [SerializedDeclaration, ...SerializedDeclaration[]]
    );
  }

  return { accessibleSymbols, symbolReferences, externalSymbols };
}

/**
 * This skips serializing declarations which can't themselves export things
 * so it will only serialize modules and namespaces, other declarations will be
 * kind: 'unknown'
 */
export function getCoreDocsInfoWithoutSimpleDeclarations(
  rootSymbols: Map<ts.Symbol, string>,
  program: ts.Program,
  isExternalSymbol: (symbol: ts.Symbol) => boolean
): CoreDocInfo {
  const symbolsQueue = new Set<ts.Symbol>(rootSymbols.keys());
  const symbolReferences = new Map<ts.Symbol, Set<ts.Symbol>>();
  const externalSymbols = new Set<ts.Symbol>();
  let currentlyVistedSymbol: ts.Symbol | undefined;
  const host: ExtractionHost = {
    referenceSymbol: (symbol) =>
      collectSymbol(
        symbol,
        isExternalSymbol,
        externalSymbols,
        currentlyVistedSymbol,
        symbolReferences,
        symbolsQueue
      ),
    program,
  };
  const accessibleSymbols = new Map<
    ts.Symbol,
    [SerializedDeclaration, ...SerializedDeclaration[]]
  >();
  for (const symbol of symbolsQueue) {
    currentlyVistedSymbol = symbol;
    const decls = symbol.declarations;
    assert(
      decls !== undefined && decls.length >= 1,
      "symbols in symbol queue must have at least one declaration"
    );
    const nameReplacement = rootSymbols.get(symbol);

    accessibleSymbols.set(
      symbol,
      decls.map((node) => {
        if (ts.isSourceFile(node) || ts.isModuleDeclaration(node)) {
          const decl = convertDeclaration(node, host);
          if (decl.kind === "module" && nameReplacement !== undefined) {
            return { ...decl, name: nameReplacement };
          }
          return decl;
        } else {
          return { kind: "unknown", name: "", content: "", docs: "" };
        }
      }) as [SerializedDeclaration, ...SerializedDeclaration[]]
    );
  }
  return { accessibleSymbols, symbolReferences, externalSymbols };
}
