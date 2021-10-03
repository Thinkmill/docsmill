import {
  createProjectSync,
  ts,
  InMemoryFileSystemHost,
  FileSystemHost,
} from "@ts-morph/bootstrap";
import fetch from "node-fetch";
import semver from "semver";
import tar from "tar-stream";
import gunzip from "gunzip-maybe";
import getNpmTarballUrl from "get-npm-tarball-url";
import { DocInfo, getDocsInfo } from "../extract";
import { collectEntrypointsOfPackage, resolveToPackageVersion } from "./utils";
import { getPackageMetadata } from "./fetch-package-metadata";
import { assert } from "../lib/assert";

async function handleTarballStream(tarballStream: NodeJS.ReadableStream) {
  const extract = tarballStream.pipe(gunzip()).pipe(tar.extract());
  const entries = new Map<string, string>();
  extract.on("entry", (headers, stream, next) => {
    if (headers.type !== "file" || !/\.(json|ts|tsx)$/.test(headers.name)) {
      stream.resume();
      stream.on("end", next);
      return;
    }

    streamToString(stream)
      .then((content) => {
        entries.set(headers.name.replace(/^[^/]+\/?/, "/"), content);
        next();
      })
      .catch((err) => (next as any)(err));
  });

  return new Promise<Map<string, string>>((resolve, reject) => {
    extract.on("finish", () => {
      resolve(entries);
    });
    extract.on("error", (err) => {
      reject(err);
    });
  });
}

function streamToString(stream: NodeJS.ReadableStream) {
  return new Promise<string>((resolve, reject) => {
    let content = "";
    stream
      .on("error", reject)
      .on("data", (chunk) => {
        content += chunk.toString("utf8");
      })
      .on("end", () => resolve(content));
  });
}

async function fetchPackageContent(pkgName: string, pkgVersion: string) {
  const tarballStream = await fetch(getNpmTarballUrl(pkgName, pkgVersion)).then(
    (res) => res.body!
  );
  return handleTarballStream(tarballStream);
}

async function getTarballAndVersions(pkgName: string, pkgSpecifier: string) {
  let pkgPromise = getPackageMetadata(pkgName);
  if (semver.valid(pkgSpecifier)) {
    const packageContentPromise = fetchPackageContent(pkgName, pkgSpecifier);
    const results = await Promise.allSettled([
      pkgPromise,
      packageContentPromise,
    ]);
    if (results[0].status !== "fulfilled") {
      throw results[0].reason;
    }
    if (results[1].status === "fulfilled") {
      return {
        versions: results[0].value.versions,
        version: pkgSpecifier,
        content: results[1].value,
      };
    }
    pkgPromise = Promise.resolve(results[0].value);
  }
  const pkg = await pkgPromise;
  const version = resolveToPackageVersion(pkg, pkgSpecifier);
  const content = await fetchPackageContent(pkgName, version);
  return { content, version, versions: pkg.versions };
}

async function addPackageToNodeModules(
  fileSystem: FileSystemHost,
  pkgName: string,
  pkgSpecifier: string
) {
  const { version, versions, content } = await getTarballAndVersions(
    pkgName,
    pkgSpecifier
  );

  const pkgPath = `/node_modules/${pkgName}`;
  for (let [filepath, fileContent] of content) {
    filepath = `${pkgPath}${filepath}`;
    fileSystem.writeFileSync(filepath, fileContent);
  }
  return { pkgPath, version, versions };
}

export async function getPackage(
  pkgName: string,
  pkgSpecifier: string
): Promise<DocInfo> {
  const fileSystem = new InMemoryFileSystemHost();

  const compilerOptions: ts.CompilerOptions = {
    noEmit: true,
    strict: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
  };

  const { versions, version, pkgPath } = await addPackageToNodeModules(
    fileSystem,
    pkgName,
    pkgSpecifier
  );

  const earlyModuleResolutionCache = ts.createModuleResolutionCache(
    fileSystem.getCurrentDirectory(),
    (x) => x,
    compilerOptions
  );

  const moduleResolutionHost = createModuleResolutionHost(fileSystem);

  const resolveModule =
    (cache: ts.ModuleResolutionCache) =>
    (moduleName: string, containingFile: string) =>
      ts.resolveModuleName(
        moduleName,
        containingFile,
        compilerOptions,
        moduleResolutionHost,
        cache
      );

  const entrypoints = await collectEntrypointsOfPackage(
    fileSystem,
    resolveModule(earlyModuleResolutionCache),
    pkgName,
    pkgPath
  );

  const collectedPackages = collectUnresolvedPackages(
    fileSystem,
    resolveModule(earlyModuleResolutionCache),
    entrypoints
  );

  const pkgJson = JSON.parse(
    fileSystem.readFileSync(`${pkgPath}/package.json`)
  );

  const resolvedDeps = new Map<string, { version: string; pkgPath: string }>();

  await Promise.all(
    [...collectedPackages].map(async (dep) => {
      const definitelyTypedDep = `@types/${
        dep.startsWith("@") ? dep.slice(1).replace("/", "__") : dep
      }`;
      let specifier =
        pkgJson.dependencies?.[definitelyTypedDep] ??
        pkgJson.optionalDependencies?.[definitelyTypedDep] ??
        pkgJson.peerDependencies?.[definitelyTypedDep] ??
        (() => {
          if (pkgJson.peerDependenciesMeta?.[definitelyTypedDep]) {
            return "*";
          }
        })();
      if (typeof specifier === "string") {
        dep = definitelyTypedDep;
      } else {
        specifier =
          pkgJson.dependencies?.[dep] ??
          pkgJson.optionalDependencies?.[dep] ??
          pkgJson.peerDependencies?.[dep] ??
          (() => {
            if (pkgJson.peerDependenciesMeta?.[dep]) {
              return "*";
            }
          })();
      }
      if (typeof specifier !== "string") return;
      const { version, pkgPath } = await addPackageToNodeModules(
        fileSystem,
        dep,
        specifier
      );

      resolvedDeps.set(dep, { version, pkgPath });
    })
  );

  const externalPackages: Map<
    string,
    { version: string; pkg: string; id: string }
  > = new Map();

  let project = createProjectSync({
    compilerOptions,
    fileSystem,
  });

  const moduleResolutionCache = ts.createModuleResolutionCache(
    project.fileSystem.getCurrentDirectory(),
    (x) => x,
    project.compilerOptions.get()
  );

  const resolvedDepsWithEntrypoints = new Map<
    string,
    { version: string; pkgPath: string; entrypoints: Map<string, string> }
  >();

  for (const [dep, { version, pkgPath }] of resolvedDeps) {
    const entrypoints = await collectEntrypointsOfPackage(
      fileSystem,
      resolveModule(moduleResolutionCache),
      dep,
      pkgPath
    );
    resolvedDepsWithEntrypoints.set(dep, { entrypoints, pkgPath, version });
  }

  const program = project.createProgram({
    rootNames: [
      ...entrypoints.values(),
      ...[...resolvedDepsWithEntrypoints].flatMap(([_, { entrypoints }]) => [
        ...entrypoints.values(),
      ]),
    ],
    options: project.compilerOptions.get(),
  });
  for (const [
    dep,
    { version, pkgPath, entrypoints },
  ] of resolvedDepsWithEntrypoints) {
    const rootSymbols = new Map<ts.Symbol, string>();
    for (const [entrypoint, resolved] of entrypoints) {
      const sourceFile = program.getSourceFile(resolved);
      assert(sourceFile !== undefined);
      const sourceFileSymbol = program
        .getTypeChecker()
        .getSymbolAtLocation(sourceFile);
      assert(sourceFileSymbol !== undefined);
      rootSymbols.set(sourceFileSymbol, entrypoint);
    }
    const { goodIdentifiers } = getDocsInfo(
      rootSymbols,
      pkgPath,
      dep,
      version,
      program
    );
    for (const [symbolId, identifier] of Object.entries(goodIdentifiers)) {
      externalPackages.set(symbolId, { version, pkg: dep, id: identifier });
    }
  }

  const rootSymbols = new Map<ts.Symbol, string>();

  for (const module of program.getTypeChecker().getAmbientModules()) {
    const decl = module.declarations?.[0];
    assert(
      decl !== undefined && ts.isModuleDeclaration(decl),
      "expected module declaration on ambient module symbol"
    );
    assert(
      ts.isStringLiteral(decl.name),
      "expected module declaration from ambient module symbol to have string literal name node"
    );
    rootSymbols.set(module, decl.name.text);
  }
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

  return {
    ...getDocsInfo(
      rootSymbols,
      pkgPath,
      pkgName,
      version,
      program,
      (symbolId) => externalPackages.get(symbolId)
    ),
    versions: [...versions].reverse(),
  };
}

function collectUnresolvedPackages(
  fileSystem: FileSystemHost,
  resolveModule: (
    moduleName: string,
    containingFile: string
  ) => ts.ResolvedModuleWithFailedLookupLocations,
  entrypoints: Map<string, string>
) {
  const collectedPackages = new Set<string>();
  const queue = new Set(entrypoints.values());
  for (const filepath of queue) {
    const content = fileSystem.readFileSync(filepath);
    const meta = ts.preProcessFile(content);
    for (const reference of meta.typeReferenceDirectives.concat(
      meta.importedFiles
    )) {
      if (!reference.fileName.startsWith(".")) {
        const match = /^(@[^/]+\/[^\/]+|[^/]+)/.exec(reference.fileName);
        if (match) {
          collectedPackages.add(match[0]);
        }
        continue;
      }
      const resolved = resolveModule(reference.fileName, filepath)
        .resolvedModule?.resolvedFileName;
      if (resolved) {
        queue.add(resolved);
      }
    }
  }
  return collectedPackages;
}

export function createModuleResolutionHost(
  fileSystem: FileSystemHost
): ts.ModuleResolutionHost {
  return {
    directoryExists: (dirName) => fileSystem.directoryExistsSync(dirName),
    fileExists: (fileName) => fileSystem.fileExistsSync(fileName),
    readFile: (fileName) => {
      try {
        return fileSystem.readFileSync(fileName);
      } catch (err) {
        // this is what the compiler api does
        if (err && (err as any).code === "ENOENT") return undefined;
        throw err;
      }
    },
    getCurrentDirectory: () => fileSystem.getCurrentDirectory(),
    getDirectories: (dirName) => {
      return fileSystem.readDirSync(dirName);
    },
    realpath: (path) => fileSystem.realpathSync(path),
  };
}
