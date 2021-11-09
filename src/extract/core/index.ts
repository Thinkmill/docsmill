import { ts } from "../ts";
import { SerializedDeclaration } from "../../lib/types";
import { convertDeclaration } from "../core/convert-declaration";
import { assert } from "../../lib/assert";

function getInitialState() {
  return {
    rootSymbols: new Map<ts.Symbol, string>(),
    accessibleSymbols: new Map<
      ts.Symbol,
      [SerializedDeclaration, ...SerializedDeclaration[]]
    >(),
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

export function getRootSymbolName(symbol: ts.Symbol) {
  return state.rootSymbols.get(symbol);
}

let state = getInitialState();

export function collectSymbol(symbol: ts.Symbol) {
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
  if (state.accessibleSymbols.has(symbol)) return;
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
  state.rootSymbols = rootSymbols;
  state.symbolsQueue = new Set(rootSymbols.keys());
  state.isExternalSymbol = isExternalSymbol;
  state.program = program;
  for (const symbol of state.symbolsQueue) {
    state.currentlyVistedSymbol = symbol;
    const decls = symbol.declarations;
    assert(
      decls !== undefined && decls.length >= 1,
      "symbols in symbol queue must have at least one declaration"
    );

    const filteredDecls = decls
      .filter((decl) => shouldIncludeDecl(decl))
      .map((decl) => convertDeclaration(decl));
    if (filteredDecls.length === 0) {
      assert(
        false,
        `at least one decl must not be filtered out but all of the decls were filtered out:\n${decls
          .map((x) => `${x.getSourceFile().fileName}\n${x.getText()}`)
          .join("\n")}`
      );
    }

    state.accessibleSymbols.set(
      symbol,
      filteredDecls as [SerializedDeclaration, ...SerializedDeclaration[]]
    );
  }
  return {
    accessibleSymbols: state.accessibleSymbols,
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
  state.rootSymbols = rootSymbols;
  state.symbolsQueue = new Set(rootSymbols.keys());
  state.isExternalSymbol = isExternalSymbol;
  state.program = program;
  for (const symbol of state.symbolsQueue) {
    state.currentlyVistedSymbol = symbol;
    const decls = symbol.declarations;
    assert(
      decls !== undefined && decls.length >= 1,
      "symbols in symbol queue must have at least one declaration"
    );

    state.accessibleSymbols.set(
      symbol,
      decls.map((decl) => {
        if (ts.isSourceFile(decl) || ts.isModuleDeclaration(decl)) {
          return convertDeclaration(decl);
        } else {
          return { kind: "unknown", name: "", content: "", docs: "" };
        }
      }) as [SerializedDeclaration, ...SerializedDeclaration[]]
    );
  }
  return {
    accessibleSymbols: state.accessibleSymbols,
    symbolReferences: state.symbolsToSymbolsWhichReferenceTheSymbol,
    externalSymbols: state.referencedExternalSymbols,
  };
}
