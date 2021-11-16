import { ts } from "../ts";
import { SerializedDeclaration } from "../../lib/types";
import { convertDeclaration } from "../core/convert-declaration";
import { assert } from "../../lib/assert";
import { getSymbolIdentifier } from "./utils";

function getInitialState() {
  return {
    symbolsQueue: new Set<ts.Symbol>(),
    symbolsToSymbolsWhichReferenceTheSymbol: new Map<
      ts.Symbol,
      Set<ts.Symbol>
    >(),
    currentlyVistedSymbol: undefined as ts.Symbol | undefined,
    referencedExternalSymbols: new Set<ts.Symbol>(),
    isExternalSymbol: (_symbol: ts.Symbol): boolean => {
      return false;
    },
    program: undefined! as ts.Program,
  };
}

export function getTypeChecker() {
  return state.program.getTypeChecker();
}

let state = getInitialState();

export function referenceSymbol(symbol: ts.Symbol) {
  assert(
    !(symbol.flags & ts.SymbolFlags.Alias) &&
      (symbol as any).mergeId === undefined,
    "alias symbols cannot be passed to referenceSymbol"
  );
  collectSymbol(symbol);
  return getSymbolIdentifier(symbol);
}

function collectSymbol(symbol: ts.Symbol) {
  if (!symbol.declarations?.length) {
    return;
  }
  if (state.isExternalSymbol(symbol)) {
    state.referencedExternalSymbols.add(symbol);
    return;
  }
  if (state.currentlyVistedSymbol && symbol !== state.currentlyVistedSymbol) {
    if (!state.symbolsToSymbolsWhichReferenceTheSymbol.has(symbol)) {
      state.symbolsToSymbolsWhichReferenceTheSymbol.set(symbol, new Set());
    }
    const symbolsThatReferenceTheThing =
      state.symbolsToSymbolsWhichReferenceTheSymbol.get(symbol)!;
    symbolsThatReferenceTheThing.add(state.currentlyVistedSymbol);
  }
  state.symbolsQueue.add(symbol);
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
  state = getInitialState();
  state.symbolsQueue = new Set(rootSymbols.keys());
  state.isExternalSymbol = isExternalSymbol;
  state.program = program;
  const accessibleSymbols = new Map<
    ts.Symbol,
    [SerializedDeclaration, ...SerializedDeclaration[]]
  >();
  for (const symbol of state.symbolsQueue) {
    state.currentlyVistedSymbol = symbol;
    const decls = symbol.declarations;
    assert(
      decls !== undefined && decls.length >= 1,
      "symbols in symbol queue must have at least one declaration"
    );

    const nameReplacement = rootSymbols.get(symbol);

    const filteredDecls = decls
      .filter((decl) => shouldIncludeDecl(decl))
      .map((node) => {
        const decl = convertDeclaration(node);
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
  return {
    accessibleSymbols,
    symbolReferences: state.symbolsToSymbolsWhichReferenceTheSymbol,
    externalSymbols: state.referencedExternalSymbols,
  };
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
  state = getInitialState();
  state.symbolsQueue = new Set(rootSymbols.keys());
  state.isExternalSymbol = isExternalSymbol;
  state.program = program;
  const accessibleSymbols = new Map<
    ts.Symbol,
    [SerializedDeclaration, ...SerializedDeclaration[]]
  >();
  for (const symbol of state.symbolsQueue) {
    state.currentlyVistedSymbol = symbol;
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
          const decl = convertDeclaration(node);
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
  return {
    accessibleSymbols,
    symbolReferences: state.symbolsToSymbolsWhichReferenceTheSymbol,
    externalSymbols: state.referencedExternalSymbols,
  };
}
