import { ts } from "../extract/ts";
import libFiles from "../../lib-files.json";

import isValidSemverVersion from "semver/functions/valid";
import { DocInfo, getDocsInfo, getIsNodeWithinPkg } from "../extract";
import { collectEntrypointsOfPackage, resolveToPackageVersion } from "./utils";
import { getPackageMetadata } from "./fetch-package-metadata";
import { assert } from "../lib/assert";
import {
  combinePaths,
  getBaseFileName,
  getDirectoryPath,
  getPathComponents,
} from "../extract/path";
import { getSourceMapHandler } from "./source-map";
import { getExternalReferenceHandler } from "./external-reference";
import { collectImports } from "./collect-imports";
import { extract } from "it-tar";

// https://github.com/pnpm/get-npm-tarball-url
function getNpmTarballUrl(pkgName: string, pkgVersion: string): string {
  const scopelessName = getScopelessName(pkgName);
  return `https://registry.npmjs.org/${pkgName}/-/${scopelessName}-${removeBuildMetadataFromVersion(
    pkgVersion
  )}.tgz`;
}

function removeBuildMetadataFromVersion(version: string) {
  const plusPos = version.indexOf("+");
  if (plusPos === -1) return version;
  return version.substring(0, plusPos);
}

function getScopelessName(name: string) {
  if (name[0] !== "@") {
    return name;
  }
  return name.split("/")[1];
}

async function* streamToIterator(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

async function handleTarballStream(tarballStream: ReadableStream<Uint8Array>) {
  const uncompressed: ReadableStream<Uint8Array> = tarballStream.pipeThrough(
    new DecompressionStream("gzip")
  );
  const iterator = streamToIterator(uncompressed);
  const entries = new Map<string, string>();

  for await (const { header, body } of extract()(iterator)) {
    if (
      header.type !== "file" ||
      !/\.(json|ts|tsx|d\.ts\.map)$/.test(header.name)
    ) {
      for await (const _ of body) {
      }
      continue;
    }
    let content = "";
    const decoder = new TextDecoder();
    for await (const chunk of body) {
      content += decoder.decode(chunk, { stream: true });
    }
    decoder.decode();
    entries.set(header.name.replace(/^[^/]+\/?/, "/"), content);
  }

  return entries;
}

async function fetchPackageContent(pkgName: string, pkgVersion: string) {
  const tarballStream = await fetch(getNpmTarballUrl(pkgName, pkgVersion)).then(
    (res) => res.body!
  );
  return handleTarballStream(tarballStream);
}

async function getTarballAndVersions(pkgName: string, pkgSpecifier: string) {
  let pkgPromise = getPackageMetadata(pkgName);
  if (isValidSemverVersion(pkgSpecifier)) {
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
        versions: results[0].value!.versions,
        version: pkgSpecifier,
        content: results[1].value,
      };
    }
    pkgPromise = Promise.resolve(results[0].value);
  }
  const pkg = await pkgPromise;
  assert(pkg !== undefined);
  const version = resolveToPackageVersion(pkg, pkgSpecifier);
  const content = await fetchPackageContent(pkgName, version);
  return { content, version, versions: pkg.versions };
}

async function addPackageToNodeModules(
  host: ts.CompilerHost,
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
    host.writeFile(filepath, fileContent, false);
  }
  return { pkgPath, version, versions };
}

const libFileCache = new Map<string, ts.SourceFile>();

export function getCompilerHost(): ts.CompilerHost & {
  directories: Map<string, Map<string, string>>;
} {
  const directories = new Map<string, Map<string, string>>();

  const readFile = (filename: string) => {
    const dirPath = getDirectoryPath(filename);
    const dir = directories.get(dirPath);
    if (!dir) {
      return undefined;
    }
    const baseName = getBaseFileName(filename);
    return dir.get(baseName);
  };
  const sourceFiles = new Map<string, ts.SourceFile>();
  let host: ts.CompilerHost & {
    directories: Map<string, Map<string, string>>;
  } = {
    directories,
    fileExists: (filename: string) => {
      return readFile(filename) !== undefined;
    },
    readFile,
    getCurrentDirectory() {
      return "/";
    },
    getDirectories(path: string) {
      let dirs: string[] = [];
      for (const [dir] of directories) {
        const dirPath = getDirectoryPath(dir);
        if (dirPath === path) {
          dirs.push(getBaseFileName(dir));
        }
      }
      return dirs;
    },
    directoryExists(dirname: string) {
      return directories.has(dirname);
    },
    getCanonicalFileName(x) {
      return x;
    },
    getNewLine() {
      return "\n";
    },
    writeFile(filename, data: string) {
      const dirPath = getDirectoryPath(filename);
      const components = getPathComponents(filename);
      const baseName = components.pop()!;
      while (components.length) {
        const end = components.pop()!;
        const joined = combinePaths(
          ...(components as [string, ...string[]]),
          end
        );
        if (directories.has(joined)) {
          break;
        }
        directories.set(joined, new Map());
      }
      const dir = directories.get(dirPath)!;
      dir.set(baseName, data);
    },
    getDefaultLibFileName: (x) =>
      `/node_modules/typescript/lib/${ts.getDefaultLibFileName(x)}`,
    getDefaultLibLocation: () => "/node_modules/typescript/lib",
    getSourceFile(filename, languageVersion) {
      const cachedSourceFile = sourceFiles.get(filename);
      if (cachedSourceFile !== undefined) {
        return cachedSourceFile;
      }
      const cachedLibSourceFile = libFileCache.get(filename);
      if (cachedLibSourceFile !== undefined) {
        return cachedLibSourceFile;
      }
      const content = readFile(filename);
      if (content === undefined) {
        return undefined;
      }
      const sourceFile = ts.createSourceFile(
        filename,
        content,
        languageVersion
      );
      if (filename.startsWith("/node_modules/typescript/lib/")) {
        libFileCache.set(filename, sourceFile);
      } else {
        sourceFiles.set(filename, sourceFile);
      }
      return sourceFile;
    },
    useCaseSensitiveFileNames() {
      return true;
    },
  };
  for (const { fileName, text } of libFiles) {
    host.writeFile(`/node_modules/typescript/lib/${fileName}`, text, false);
  }
  return host;
}

export type PackageDocInfo = DocInfo & {
  packageName: string;
  version: string;
  versions: string[];
};

export async function getPackage(
  pkgName: string,
  pkgSpecifier: string
): Promise<PackageDocInfo> {
  // const fileSystem = new InMemoryFileSystemHost();

  const compilerOptions: ts.CompilerOptions = {
    noEmit: true,
    strict: true,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext,
  };

  const compilerHost = getCompilerHost();

  const { versions, version, pkgPath } = await addPackageToNodeModules(
    compilerHost,
    pkgName,
    pkgSpecifier
  );

  const moduleResolutionHost: ts.ModuleResolutionHost = compilerHost;

  const earlyModuleResolutionCache = ts.createModuleResolutionCache(
    moduleResolutionHost.getCurrentDirectory!(),
    (x) => x,
    compilerOptions
  );

  const entrypoints = collectEntrypointsOfPackage(
    pkgName,
    pkgPath,
    compilerOptions,
    moduleResolutionHost,
    earlyModuleResolutionCache
  );

  const collectedPackages = collectUnresolvedPackages(
    entrypoints,
    compilerOptions,
    compilerHost,
    earlyModuleResolutionCache
  );

  const pkgJson = JSON.parse(
    moduleResolutionHost.readFile(`${pkgPath}/package.json`)!
  );

  const resolvedDepsWithEntrypoints = new Map<
    string,
    { version: string; pkgPath: string; entrypoints: Map<string, string> }
  >();

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
        compilerHost,
        dep,
        specifier
      );

      const moduleResolutionCache = ts.createModuleResolutionCache(
        compilerHost.getCurrentDirectory(),
        (x) => x,
        compilerOptions
      );
      const entrypoints = collectEntrypointsOfPackage(
        dep,
        pkgPath,
        compilerOptions,
        moduleResolutionHost,
        moduleResolutionCache
      );
      resolvedDepsWithEntrypoints.set(dep, { entrypoints, pkgPath, version });
    })
  );

  const program = ts.createProgram({
    rootNames: [
      ...entrypoints.values(),
      ...[...resolvedDepsWithEntrypoints].flatMap(([_, { entrypoints }]) => [
        ...entrypoints.values(),
      ]),
    ],
    options: compilerOptions,
    host: compilerHost,
  });

  const isWithinPkg = getIsNodeWithinPkg(pkgPath);

  const rootSymbols = new Map<ts.Symbol, string>();

  const typeChecker = program.getTypeChecker();

  for (const module of typeChecker.getAmbientModules()) {
    const decl = module.declarations?.[0];
    assert(
      decl !== undefined && ts.isModuleDeclaration(decl),
      "expected module declaration on ambient module symbol"
    );
    assert(
      ts.isStringLiteral(decl.name),
      "expected module declaration from ambient module symbol to have string literal name node"
    );
    if (isWithinPkg(decl)) {
      rootSymbols.set(module, decl.name.text);
    }
  }
  for (const [entrypoint, resolved] of entrypoints) {
    const sourceFile = program.getSourceFile(resolved);
    assert(sourceFile !== undefined);
    const sourceFileSymbol = typeChecker.getSymbolAtLocation(sourceFile);
    if (sourceFileSymbol) {
      rootSymbols.set(sourceFileSymbol, entrypoint);
    }
  }

  return {
    packageName: pkgName,
    version,
    versions: [...versions].reverse(),
    ...getDocsInfo(
      rootSymbols,
      pkgPath,
      pkgName,
      program,
      getExternalReferenceHandler(program, resolvedDepsWithEntrypoints),
      getSourceMapHandler(compilerHost, pkgName)
    ),
  };
}

export function collectUnresolvedPackages(
  entrypoints: Map<string, string>,
  compilerOptions: ts.CompilerOptions,
  host: ts.CompilerHost,
  moduleResolutionCache: ts.ModuleResolutionCache
) {
  const collectedPackages = new Set<string>();
  const queue = new Set(entrypoints.values());
  for (const filepath of queue) {
    const sourceFile = host.getSourceFile(filepath, ts.ScriptTarget.ESNext);
    assert(
      sourceFile !== undefined,
      `expected to be able to read file at ${filepath}`
    );

    const references = [];
    for (const x of sourceFile.typeReferenceDirectives) {
      references.push(x.fileName);
    }
    const imports = collectImports(sourceFile);
    for (const imported of imports) {
      references.push(imported.text);
    }

    for (const reference of references) {
      if (!reference.startsWith(".")) {
        const match = /^(@[^/]+\/[^\/]+|[^/]+)/.exec(reference);
        if (match) {
          collectedPackages.add(match[0]);
        }
        continue;
      }

      const resolved = ts.resolveModuleName(
        reference,
        filepath,
        compilerOptions,
        host,
        moduleResolutionCache
      ).resolvedModule?.resolvedFileName;
      if (resolved) {
        queue.add(resolved);
      }
    }
  }
  return collectedPackages;
}
