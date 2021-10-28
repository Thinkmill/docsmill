import { ts } from "./extract/ts";
import { assert } from "./lib/assert";
import { getDocsInfo } from "./extract";
import { collectEntrypointsOfPackage } from "./npm/utils";
import { collectUnresolvedPackages, getExternalSymbolIdMap } from "./npm";
import { getDirectoryPath, resolvePath } from "./extract/path";

const getCanonicalFileName = ts.sys.useCaseSensitiveFileNames
  ? (x: string) => x
  : (x: string) => x.toLowerCase();

function getFromTsConfig(tsConfigFilePath: string) {
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

export async function getInfo(filename: string) {
  const { compilerOptions, rootNames } = getFromTsConfig("./tsconfig.json");
  const program = ts.createProgram({ options: compilerOptions, rootNames });
  const resolved = resolvePath(process.cwd(), filename);
  const sourceFile = program.getSourceFile(resolved);
  assert(sourceFile !== undefined, `could not get source file ${resolved}`);
  const rootSymbol = program.getTypeChecker().getSymbolAtLocation(sourceFile);
  assert(rootSymbol !== undefined, "could not get symbol for source file");
  const rootSymbols = new Map([[rootSymbol, "test"]]);
  return getDocsInfo(rootSymbols, ".", "test", "0.0.0", program);
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

  const moduleResolutionHost: ts.ModuleResolutionHost = ts.sys;

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
    moduleResolutionHost,
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

  const program = ts.createProgram({ options: compilerOptions, rootNames });

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
    pkgJson.version,
    program,
    (x) => externalSymbols.get(x)
  );
}
