import { ts } from "./extract/ts";
import { assert } from "./lib/assert";
import { getDocsInfo } from "./extract";
import { collectEntrypointsOfPackage } from "./npm/utils";
import { collectUnresolvedPackages } from "./npm";
import { getDirectoryPath, resolvePath } from "./extract/path";
import { SymbolId } from "./lib/types";
import { objectEntriesAssumeNoExcessProps } from "./lib/utils";

const getCanonicalFileName = ts.sys.useCaseSensitiveFileNames
  ? (x: string) => x
  : (x: string) => x.toLowerCase();

export function getFromTsConfig(tsConfigFilePath: string) {
  let configFileDiagnostic: ts.Diagnostic | undefined;

  const parsedCommandLine = ts.getParsedCommandLineOfConfigFile(
    tsConfigFilePath,
    undefined,
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic(diagnostic) {
        configFileDiagnostic = diagnostic;
      },
    }
  );

  if (configFileDiagnostic) {
    throw new Error(
      ts.formatDiagnostic(configFileDiagnostic, {
        getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
        getNewLine: () => ts.sys.newLine,
        getCanonicalFileName,
      })
    );
  }
  assert(
    parsedCommandLine !== undefined,
    `could not create ts project from config file at: ${tsConfigFilePath}`
  );
  const compilerOptions: ts.CompilerOptions = {
    ...parsedCommandLine.options,
    resolveJsonModule: true,
  };
  return { compilerOptions, rootNames: parsedCommandLine.fileNames };
}

export function getInfo(filename: string) {
  const { compilerOptions, rootNames } = getFromTsConfig("../tsconfig.json");
  const program = ts.createProgram({ options: compilerOptions, rootNames });
  const resolved = resolvePath(process.cwd(), filename);
  const sourceFile = program.getSourceFile(resolved);
  assert(sourceFile !== undefined, `could not get source file ${resolved}`);
  const rootSymbol = program.getTypeChecker().getSymbolAtLocation(sourceFile);
  assert(rootSymbol !== undefined, "could not get symbol for source file");
  const rootSymbols = new Map([[rootSymbol, "test"]]);
  return getDocsInfo(rootSymbols, ".", "test", program);
}

export async function getFromLocalPackage(
  tsConfigFilePath: string,
  pkgPath: string
) {
  tsConfigFilePath = resolvePath(process.cwd(), tsConfigFilePath);
  pkgPath = resolvePath(process.cwd(), pkgPath);

  const { compilerOptions, rootNames } = getFromTsConfig(tsConfigFilePath);

  const moduleResolutionCache = ts.createModuleResolutionCache(
    ts.sys.getCurrentDirectory(),
    getCanonicalFileName,
    compilerOptions
  );

  const compilerHost: ts.CompilerHost = ts.createCompilerHost(compilerOptions);

  const moduleResolutionHost: ts.ModuleResolutionHost = compilerHost;

  const pkgJson = JSON.parse(
    moduleResolutionHost.readFile(`${pkgPath}/package.json`)!
  );
  const entrypoints = collectEntrypointsOfPackage(
    pkgJson.name,
    pkgPath,
    compilerOptions,
    moduleResolutionHost,
    moduleResolutionCache
  );
  const collectedPackages = collectUnresolvedPackages(
    entrypoints,
    compilerOptions,
    compilerHost,
    moduleResolutionCache
  );

  const resolvedDepsWithEntrypoints = new Map<
    string,
    { version: string; pkgPath: string; entrypoints: Map<string, string> }
  >();
  const resolveModule = (moduleName: string, containingFile: string) =>
    ts.resolveModuleName(
      moduleName,
      containingFile,
      compilerOptions,
      moduleResolutionHost,
      moduleResolutionCache
    );
  for (const dep of collectedPackages) {
    let resolved = resolveModule(
      `@types/${dep}/package.json`,
      pkgPath + "/index.ts"
    );
    if (!resolved.resolvedModule) {
      resolved = resolveModule(`${dep}/package.json`, pkgPath + "/index.ts");
    }
    assert(
      resolved.resolvedModule !== undefined,
      `expected to be able to resolve ${dep}/package.json from ${pkgPath}/index.ts`
    );
    const version = JSON.parse(
      moduleResolutionHost.readFile(resolved.resolvedModule.resolvedFileName)!
    ).version;
    const depPkgPath = getDirectoryPath(
      resolved.resolvedModule.resolvedFileName
    );
    const entrypoints = collectEntrypointsOfPackage(
      dep,
      depPkgPath,
      compilerOptions,
      moduleResolutionHost,
      moduleResolutionCache
    );
    resolvedDepsWithEntrypoints.set(dep, {
      entrypoints,
      pkgPath: depPkgPath,
      version,
    });
  }

  const rootSymbols = new Map<ts.Symbol, string>();

  const program = ts.createProgram({
    options: compilerOptions,
    rootNames,
    host: compilerHost,
  });

  const externalSymbols = getExternalSymbolIdMap(
    program,
    resolvedDepsWithEntrypoints
  );
  for (const [entrypoint, resolved] of entrypoints) {
    const sourceFile = program.getSourceFile(resolved);
    assert(sourceFile !== undefined);
    const sourceFileSymbol = program
      .getTypeChecker()
      .getSymbolAtLocation(sourceFile);
    if (sourceFileSymbol) {
      rootSymbols.set(sourceFileSymbol, entrypoint);
    }
  }
  return getDocsInfo(
    rootSymbols,
    pkgPath,
    pkgJson.name,
    program,
    (_, symbolId) => externalSymbols.get(symbolId)
  );
}

export function getExternalSymbolIdMap(
  program: ts.Program,
  resolvedDepsWithEntrypoints: Map<
    string,
    { version: string; pkgPath: string; entrypoints: Map<string, string> }
  >
) {
  const externalPackages: Map<
    SymbolId,
    { version: string; pkg: string; id: string }
  > = new Map();
  for (const [
    dep,
    { version, pkgPath, entrypoints },
  ] of resolvedDepsWithEntrypoints) {
    const rootSymbols = new Map<ts.Symbol, string>();
    for (const [entrypoint, resolved] of entrypoints) {
      const sourceFile = program.getSourceFile(resolved);
      if (sourceFile) {
        assert(
          sourceFile !== undefined,
          `expected to be able to get source file for ${resolved}`
        );
        const sourceFileSymbol = program
          .getTypeChecker()
          .getSymbolAtLocation(sourceFile);
        assert(sourceFileSymbol !== undefined);
        rootSymbols.set(sourceFileSymbol, entrypoint);
      }
    }
    const { goodIdentifiers } = getDocsInfo(rootSymbols, pkgPath, dep, program);
    for (const [symbolId, identifier] of objectEntriesAssumeNoExcessProps(
      goodIdentifiers
    )) {
      externalPackages.set(symbolId, {
        version,
        pkg: dep,
        id: identifier,
      });
    }
  }
  return externalPackages;
}
