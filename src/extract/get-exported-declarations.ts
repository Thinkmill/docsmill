import { ts } from "./ts";
import { getTypeChecker } from ".";
import { getAliasedSymbol, getSymbolAtLocation } from "./utils";

// this is based on ModuledNode.getExportedDeclarations in ts-morph
// but not using ts-morph directly it's probably not exactly what
// we want but i'd like to use TypeScript's API more directly and this is a step to getting there
export function getExportedDeclarations(
  symbol: ts.Symbol
): ReadonlyMap<string, ts.Declaration[]> {
  const result = new Map<string, ts.Declaration[]>();
  const typeChecker = getTypeChecker();
  const exportSymbols = typeChecker.getExportsOfModule(symbol);

  for (const symbol of exportSymbols) {
    for (const declaration of symbol.declarations || []) {
      const declarations = Array.from(
        getDeclarationHandlingImportsAndExports(declaration)
      ) as ts.Declaration[];
      const name = symbol.getName();
      const existingArray = result.get(name);
      if (existingArray !== undefined) {
        existingArray.push(...declarations);
      } else {
        result.set(symbol.getName(), declarations);
      }
    }
  }

  return result;

  function* getDeclarationHandlingImportsAndExports(
    declaration: ts.Node
  ): IterableIterator<ts.Node> {
    if (ts.isExportSpecifier(declaration)) {
      for (const d of typeChecker.getExportSpecifierLocalTargetSymbol(
        declaration
      )?.declarations ?? [])
        yield* getDeclarationHandlingImportsAndExports(d);
    } else if (ts.isExportAssignment(declaration)) {
      if (!ts.isIdentifier(declaration.expression)) {
        yield declaration.expression;
        return;
      }
      yield* getDeclarationsForSymbol(
        getSymbolAtLocation(declaration.expression)
      );
    } else if (ts.isImportSpecifier(declaration)) {
      const identifier = declaration.name;
      const symbol = getSymbolAtLocation(identifier);
      if (symbol === undefined) return;
      yield* getDeclarationsForSymbol(getAliasedSymbol(symbol) || symbol);
    } else if (ts.isImportClause(declaration)) {
      const identifier = declaration.name;
      if (identifier === undefined) return;
      const symbol = getSymbolAtLocation(identifier);
      if (symbol === undefined) return;
      yield* getDeclarationsForSymbol(getAliasedSymbol(symbol) || symbol);
    } else if (
      ts.isNamespaceImport(declaration) ||
      ts.isNamespaceExport(declaration)
    ) {
      const symbol = getSymbolAtLocation(declaration.name);
      if (symbol === undefined) return;
      yield* getDeclarationsForSymbol(getAliasedSymbol(symbol) || symbol);
    } else {
      yield declaration;
    }

    function* getDeclarationsForSymbol(
      symbol: ts.Symbol | undefined
    ): IterableIterator<ts.Node> {
      if (symbol == null || !symbol.declarations) return;
      for (const d of symbol.declarations)
        yield* getDeclarationHandlingImportsAndExports(d);
    }
  }
}
