import { ts } from "../ts";
import { SerializedDeclaration } from "../../lib/types";
import { convertDeclaration } from "../core/convert-declaration";
import { assert, isNonEmptyArray } from "../../lib/assert";
import { getSymbolIdentifier } from "./utils";

export type ExtractionHost<Docs> = {
  referenceSymbol: (symbol: ts.Symbol) => void;
  program: ts.Program;
  getDocs: (node: ts.Node) => Docs;
};

export function getTypeChecker(host: { program: ts.Program }): ts.TypeChecker {
  return host.program.getTypeChecker();
}

export function referenceSymbol(
  symbol: ts.Symbol,
  host: ExtractionHost<unknown>
) {
  assert(
    (symbol.flags & ts.SymbolFlags.AliasExcludes) === 0 &&
      (symbol as any).mergeId === undefined,
    "alias symbols cannot be passed to referenceSymbol"
  );
  host.referenceSymbol(symbol);
  return getSymbolIdentifier(symbol);
}

export type BaseCoreDocInfo<Docs> = {
  accessibleSymbols: Map<
    ts.Symbol,
    [SerializedDeclaration<Docs>, ...SerializedDeclaration<Docs>[]]
  >;
  externalSymbols: Set<ts.Symbol>;
};

export type CoreDocInfo<Docs> = BaseCoreDocInfo<Docs> & {
  symbolReferences: Map<ts.Symbol, Set<ts.Symbol>>;
};

export function getCoreDocsInfo<Docs>(
  rootSymbols: Map<ts.Symbol, string>,
  program: ts.Program,
  isExternalSymbol: (symbol: ts.Symbol) => boolean,
  shouldIncludeDecl: (node: ts.Node) => boolean,
  getDocs: (node: ts.Node) => Docs
): CoreDocInfo<Docs> {
  const symbolsQueue = new Set<ts.Symbol>(rootSymbols.keys());
  const symbolReferences = new Map<ts.Symbol, Set<ts.Symbol>>();
  const externalSymbols = new Set<ts.Symbol>();
  let currentlyVistedSymbol: ts.Symbol | undefined;
  const host: ExtractionHost<Docs> = {
    getDocs,
    referenceSymbol: (symbol) => {
      if (!symbol.declarations?.length) {
        return;
      }
      if (isExternalSymbol(symbol)) {
        externalSymbols.add(symbol);
        return;
      }
      if (
        currentlyVistedSymbol !== undefined &&
        symbol !== currentlyVistedSymbol
      ) {
        if (!symbolReferences.has(symbol)) {
          symbolReferences.set(symbol, new Set());
        }
        const symbolsThatReferenceTheThing = symbolReferences.get(symbol)!;
        symbolsThatReferenceTheThing.add(currentlyVistedSymbol);
      }
      symbolsQueue.add(symbol);
    },
    program,
  };
  const accessibleSymbols = new Map<
    ts.Symbol,
    [SerializedDeclaration<Docs>, ...SerializedDeclaration<Docs>[]]
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
    if (!isNonEmptyArray(filteredDecls)) {
      assert(
        false,
        `at least one decl must not be filtered out but all of the decls were filtered out:\n${decls
          .map((x) => `${x.getSourceFile().fileName}\n${x.getText()}`)
          .join("\n")}`
      );
    }

    accessibleSymbols.set(symbol, filteredDecls);
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
): BaseCoreDocInfo<unknown> {
  const symbolsQueue = new Set<ts.Symbol>(rootSymbols.keys());
  const externalSymbols = new Set<ts.Symbol>();
  const host: ExtractionHost<unknown> = {
    getDocs: () => null,
    referenceSymbol: (symbol) => {
      if (!symbol.declarations?.length) {
        return;
      }
      if (!isExternalSymbol(symbol)) {
        symbolsQueue.add(symbol);
      }
    },
    program,
  };
  const accessibleSymbols = new Map<
    ts.Symbol,
    [SerializedDeclaration<unknown>, ...SerializedDeclaration<unknown>[]]
  >();
  for (const symbol of symbolsQueue) {
    const decls = symbol.declarations;
    assert(
      decls !== undefined && isNonEmptyArray(decls),
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
      })
    );
  }
  return { accessibleSymbols, externalSymbols };
}
