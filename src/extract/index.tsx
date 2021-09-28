import { Project, Symbol, SourceFile, ts } from "ts-morph";
import path from "path";
import { findCanonicalExportLocations } from "./exports";
import {
  getSymbolIdentifier,
  getSymbolsForInnerBitsAndGoodIdentifiers,
  wrapInTsMorphSymbol,
} from "./utils";
import { SerializedDeclaration } from "../lib/types";
import { convertDeclaration } from "./convert-declaration";
import { assert } from "../lib/assert";

function getInitialState() {
  return {
    rootSymbols: new Map<Symbol, string>(),
    publicSymbols: new Map<
      Symbol,
      [SerializedDeclaration, ...SerializedDeclaration[]]
    >(),
    symbolsQueue: new Set<Symbol>(),
    symbolsToSymbolsWhichReferenceTheSymbol: new Map<Symbol, Set<Symbol>>(),
    currentlyVistedSymbol: undefined as Symbol | undefined,
    referencedExternalSymbols: new Set<Symbol>(),
    pkgDir: "",
    project: undefined as unknown as Project,
  };
}

export function getProject() {
  return state.project;
}

export function getRootSymbolName(symbol: Symbol) {
  return state.rootSymbols.get(symbol);
}

let state = getInitialState();

export function collectSymbol(_symbol: Symbol | ts.Symbol) {
  const symbol =
    _symbol instanceof Symbol ? _symbol : wrapInTsMorphSymbol(_symbol);

  if (symbol.getDeclarations().length === 0) {
    return;
  }
  const decl = symbol.getDeclarations()[0];
  if (
    !decl.getSourceFile().getFilePath().includes(state.pkgDir) ||
    decl
      .getSourceFile()
      .getFilePath()
      .includes(path.join(state.pkgDir, "node_modules"))
  ) {
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
  if (state.publicSymbols.has(symbol)) return;
  state.symbolsQueue.add(symbol);
}

export type DocInfo = {
  packageName: string;
  rootSymbols: string[];
  accessibleSymbols: { [k: string]: SerializedDeclaration[] };
  symbolReferences: { [k: string]: string[] };
  canonicalExportLocations: {
    [k: string]: readonly [exportName: string, fileSymbolId: string];
  };
  goodIdentifiers: Record<string, string>;
  symbolsForInnerBit: Record<string, string[]>;
  externalSymbols: Record<string, { pkg: string; version: string; id: string }>;
  versions?: string[];
  currentVersion: string;
};

export function getDocsInfo(
  rootSymbols: Map<Symbol, string>,
  pkgDir: string,
  packageName: string,
  currentVersion: string,
  project: Project,
  getExternalReference: (
    symbolId: string
  ) => { pkg: string; version: string; id: string } | undefined = () =>
    undefined
): DocInfo {
  state = getInitialState();
  state.rootSymbols = rootSymbols;
  state.symbolsQueue = new Set(rootSymbols.keys());
  state.pkgDir = pkgDir;
  state.project = project;

  resolveSymbolQueue();

  const baseInfo = {
    packageName,
    currentVersion,
    rootSymbols: [...state.rootSymbols.keys()].map((symbol) =>
      getSymbolIdentifier(symbol)
    ),
    accessibleSymbols: Object.fromEntries(
      [...state.publicSymbols].map(([symbol, rootThing]) => [
        getSymbolIdentifier(symbol),
        rootThing,
      ])
    ),
    symbolReferences: Object.fromEntries(
      [...state.symbolsToSymbolsWhichReferenceTheSymbol].map(
        ([symbol, symbolsThatReferenceIt]) => {
          return [
            getSymbolIdentifier(symbol.getAliasedSymbol() || symbol),
            [...symbolsThatReferenceIt].map((x) =>
              getSymbolIdentifier(x.getAliasedSymbol() || x)
            ),
          ];
        }
      )
    ),
    canonicalExportLocations: Object.fromEntries(
      [
        ...findCanonicalExportLocations(
          [...state.rootSymbols.keys()].map(
            (symbol) => symbol.getDeclarations()[0] as SourceFile
          )
        ),
      ].map(([symbol, { exportName, parent }]) => {
        return [
          getSymbolIdentifier(symbol),
          [exportName, getSymbolIdentifier(parent.getSymbolOrThrow())] as const,
        ];
      })
    ),
  };

  const externalSymbols: DocInfo["externalSymbols"] = {};
  for (const x of state.referencedExternalSymbols) {
    const symbolId = getSymbolIdentifier(x);
    const ref = getExternalReference(symbolId);
    if (ref) {
      externalSymbols[symbolId] = ref;
    }
  }

  return {
    ...baseInfo,
    ...getSymbolsForInnerBitsAndGoodIdentifiers(
      baseInfo.accessibleSymbols,
      baseInfo.packageName,
      baseInfo.canonicalExportLocations,
      baseInfo.symbolReferences,
      baseInfo.rootSymbols
    ),
    externalSymbols,
  };
}

export async function getInfo(filename: string) {
  let project = new Project({
    tsConfigFilePath: "./tsconfig.json",
  });
  const sourceFile = project.getSourceFileOrThrow(path.resolve(filename));
  const rootSymbols = new Map([[sourceFile.getSymbolOrThrow(), "test"]]);
  return getDocsInfo(rootSymbols, ".", "test", "0.0.0", project);
}

function resolveSymbolQueue() {
  while (state.symbolsQueue.size) {
    const symbol: Symbol = state.symbolsQueue.values().next().value;
    state.symbolsQueue.delete(symbol);
    state.currentlyVistedSymbol = symbol;
    const decls = symbol.getDeclarations();
    assert(
      decls.length >= 1,
      "symbols in symbol queue must have at least one declaration"
    );

    state.publicSymbols.set(
      symbol,
      decls.map((decl) => convertDeclaration(decl, symbol.compilerSymbol)) as [
        SerializedDeclaration,
        ...SerializedDeclaration[]
      ]
    );
  }
}
