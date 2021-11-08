import { SymbolFlags } from "typescript";
import { getDocsInfo } from "../../extract";
import { ts } from "../../extract/ts";

export { Root as default } from "../../components/root";

import { getFromTsConfig } from "../../local-extract";

export function getStaticProps() {
  const { compilerOptions, rootNames } = getFromTsConfig("./tsconfig.json");

  const program = ts.createProgram({
    options: compilerOptions,
    rootNames,
  });
  const typeChecker = program.getTypeChecker();
  const globalThisSymbol: ts.Symbol = (typeChecker as any).resolveName(
    "globalThis",
    undefined,
    SymbolFlags.Module,
    false
  );

  const rootSymbols = new Map(
    [...(globalThisSymbol.exports as Map<string, ts.Symbol>).values()]
      .filter((x) =>
        x.declarations?.some((x) =>
          x.getSourceFile().fileName.includes("/node_modules/typescript/lib")
        )
      )
      .map((x) => [x, ""])
  );

  return {
    props: getDocsInfo(rootSymbols, process.cwd(), "lib", "0.0.0", program),
  };
}
