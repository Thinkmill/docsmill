import { createProject, ts } from "@ts-morph/bootstrap";
import { assert } from "./lib/assert";
import path from "path";
import { getDocsInfo } from "./extract";
import { collectEntrypointsOfPackage } from "./npm/utils";
import {
  collectUnresolvedPackages,
  createModuleResolutionHost,
  getExternalSymbolIdMap,
} from "./npm";

export async function getInfo(filename: string) {
  let project = await createProject({
    tsConfigFilePath: "./tsconfig.json",
  });
  const sourceFile = project.getSourceFileOrThrow(path.resolve(filename));
  const program = project.createProgram();
  const rootSymbol = program.getTypeChecker().getSymbolAtLocation(sourceFile);
  assert(rootSymbol !== undefined);
  const rootSymbols = new Map([[rootSymbol, "test"]]);
  return getDocsInfo(rootSymbols, ".", "test", "0.0.0", program);
}

export async function getFromLocalPackage(
  tsConfigFilePath: string,
  pkgPath: string
) {
  tsConfigFilePath = path.resolve(tsConfigFilePath);
  pkgPath = path.resolve(pkgPath);
  let project = await createProject({
    tsConfigFilePath,
    compilerOptions: {
      resolveJsonModule: true,
    },
  });
  const compilerOptions = project.compilerOptions.get();
  const fileSystem = project.fileSystem;
  const moduleResolutionCache = ts.createModuleResolutionCache(
    project.fileSystem.getCurrentDirectory(),
    (x) => (ts.sys.useCaseSensitiveFileNames ? x : x.toLowerCase()),
    compilerOptions
  );

  const moduleResolutionHost = createModuleResolutionHost(project.fileSystem);
  const resolveModule = (moduleName: string, containingFile: string) =>
    ts.resolveModuleName(
      moduleName,
      containingFile,
      compilerOptions,
      moduleResolutionHost,
      moduleResolutionCache
    );
  const pkgJson = JSON.parse(
    await project.fileSystem.readFile(`${pkgPath}/package.json`)
  );
  const entrypoints = await collectEntrypointsOfPackage(
    project.fileSystem,
    resolveModule,
    pkgJson.name,
    pkgPath
  );
  const collectedPackages = collectUnresolvedPackages(
    fileSystem,
    resolveModule,
    entrypoints
  );

  const resolvedDepsWithEntrypoints = new Map<
    string,
    { version: string; pkgPath: string; entrypoints: Map<string, string> }
  >();
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
      await fileSystem.readFile(resolved.resolvedModule.resolvedFileName)
    ).version;
    const depPkgPath = path.dirname(resolved.resolvedModule.resolvedFileName);
    const entrypoints = await collectEntrypointsOfPackage(
      fileSystem,
      resolveModule,
      dep,
      depPkgPath
    );
    resolvedDepsWithEntrypoints.set(dep, {
      entrypoints,
      pkgPath: depPkgPath,
      version,
    });
  }

  const rootSymbols = new Map<ts.Symbol, string>();

  const program = project.createProgram();

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
