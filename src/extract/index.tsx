import { ts } from "./ts";
import { findCanonicalExportLocations } from "./exports";
import {
  getAliasedSymbol,
  getSymbolIdentifier,
  getSymbolsForInnerBitsAndGoodIdentifiers,
} from "./utils";
import { SerializedDeclaration, SymbolId } from "../lib/types";
import { convertDeclaration } from "./convert-declaration";
import { assert } from "../lib/assert";
import { combinePaths } from "./path";

function getInitialState() {
  return {
    rootSymbols: new Map<ts.Symbol, string>(),
    publicSymbols: new Map<
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
    program: (): ts.Program => {
      throw new Error("program not set");
    },
  };
}

export function getTypeChecker() {
  return state.program().getTypeChecker();
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
  if (state.publicSymbols.has(symbol)) return;
  state.symbolsQueue.add(symbol);
}

export type DocInfo = {
  packageName: string;
  rootSymbols: SymbolId[];
  accessibleSymbols: { [key: SymbolId]: SerializedDeclaration[] };
  symbolReferences: { [key: SymbolId]: SymbolId[] };
  canonicalExportLocations: {
    [k: SymbolId]: readonly [exportName: string, fileSymbolId: SymbolId];
  };
  goodIdentifiers: Record<SymbolId, string>;
  symbolsForInnerBit: Record<SymbolId, SymbolId[]>;
  externalSymbols: Record<
    SymbolId,
    { pkg: string; version: string; id: string }
  >;
  versions?: string[];
  currentVersion: string;
  locations: Record<
    SymbolId,
    { file: string; line: number; src?: { file: string; line: number } }[]
  >;
};

export function getDocsInfo(
  rootSymbols: Map<ts.Symbol, string>,
  pkgDir: string,
  packageName: string,
  currentVersion: string,
  program: ts.Program,
  getExternalReference: (
    symbolId: SymbolId
  ) => { pkg: string; version: string; id: string } | undefined = () =>
    undefined,
  getSrcMapping: (
    distFilename: string,
    line: number
  ) => { file: string; line: number } | undefined = () => undefined
): DocInfo {
  state = getInitialState();
  state.rootSymbols = rootSymbols;
  state.symbolsQueue = new Set(rootSymbols.keys());
  const pkgDirNodeModules = combinePaths(pkgDir, "node_modules");
  state.isExternalSymbol = (symbol: ts.Symbol) => {
    const decl = symbol.declarations![0];
    const sourceFile = decl.getSourceFile();
    if (
      !sourceFile.fileName.includes(pkgDir) ||
      sourceFile.fileName.includes(pkgDirNodeModules)
    ) {
      return true;
    }
    return false;
  };
  state.program = () => program;
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
            getSymbolIdentifier(getAliasedSymbol(symbol) || symbol),
            [...symbolsThatReferenceIt].map((x) =>
              getSymbolIdentifier(getAliasedSymbol(x) || x)
            ),
          ];
        }
      )
    ),
    canonicalExportLocations: Object.fromEntries(
      [...findCanonicalExportLocations([...state.rootSymbols.keys()])].map(
        ([symbol, { exportName, parent }]) => {
          return [
            getSymbolIdentifier(symbol),
            [exportName, getSymbolIdentifier(parent)] as const,
          ];
        }
      )
    ),
    locations: Object.fromEntries(
      [...state.publicSymbols].map(([symbol]) => {
        return [
          getSymbolIdentifier(symbol),
          symbol.declarations!.map((decl) => {
            const sourceFile = decl.getSourceFile();
            const fileName = sourceFile.fileName;
            const line = sourceFile.getLineAndCharacterOfPosition(
              (decl as any).name?.pos ?? decl.pos
            ).line;
            const src = getSrcMapping(fileName, line);
            return {
              file: fileName.replace(pkgDir, ""),
              line,
              ...(src ? { src } : {}),
            };
          }),
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

function resolveSymbolQueue() {
  while (state.symbolsQueue.size) {
    const symbol: ts.Symbol = state.symbolsQueue.values().next().value;
    state.symbolsQueue.delete(symbol);
    state.currentlyVistedSymbol = symbol;
    const decls = symbol.declarations;
    assert(
      decls !== undefined && decls.length >= 1,
      "symbols in symbol queue must have at least one declaration"
    );

    state.publicSymbols.set(
      symbol,
      decls.map((decl) => convertDeclaration(decl)) as [
        SerializedDeclaration,
        ...SerializedDeclaration[]
      ]
    );
  }
}
