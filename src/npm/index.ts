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
import { decode as decodeVlq } from "vlq";
import {
  getBaseFileName,
  getDirectoryPath,
  resolvePath,
} from "../extract/path";
import { SymbolId } from "../lib/types";

async function handleTarballStream(tarballStream: NodeJS.ReadableStream) {
  const extract = tarballStream.pipe(gunzip()).pipe(tar.extract());
  const entries = new Map<string, string>();
  extract.on("entry", (headers, stream, next) => {
    if (
      headers.type !== "file" ||
      !/\.(json|ts|tsx|d\.ts\.map)$/.test(headers.name)
    ) {
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

  const moduleResolutionHost = createModuleResolutionHost(fileSystem);

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
    moduleResolutionHost,
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
        fileSystem,
        dep,
        specifier
      );

      const moduleResolutionCache = ts.createModuleResolutionCache(
        fileSystem.getCurrentDirectory(),
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

  let project = createProjectSync({
    compilerOptions,
    fileSystem,
  });

  const program = project.createProgram({
    rootNames: [
      ...entrypoints.values(),
      ...[...resolvedDepsWithEntrypoints].flatMap(([_, { entrypoints }]) => [
        ...entrypoints.values(),
      ]),
    ],
    options: project.compilerOptions.get(),
  });

  const externalSymbols = getExternalSymbolIdMap(
    program,
    resolvedDepsWithEntrypoints
  );

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

  const getSourceMap = memoize((distFilename: string) => {
    let content;
    try {
      content = fileSystem.readFileSync(distFilename + ".map", "utf8");
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return undefined;
      }
      throw err;
    }
    let sourceMapContent:
      | {
          sourceRoot: string;
          sources: [string];
          mappings: string;
        }
      | undefined;
    try {
      sourceMapContent = JSON.parse(content);
    } catch (err) {
      console.log(
        "could not parse source file content for ",
        distFilename + ".map"
      );
      return undefined;
    }
    sourceMapContent = sourceMapContent!;
    const sourceRoot = resolvePath(
      getDirectoryPath(distFilename),
      sourceMapContent.sourceRoot
    );
    const srcFilename = resolvePath(sourceRoot, sourceMapContent.sources[0]);

    if (!fileSystem.fileExistsSync(srcFilename)) {
      console.log("source file for .d.ts.map not found", srcFilename);
      return undefined;
    }
    const vlqs = sourceMapContent.mappings
      .split(";")
      .map((line) => line.split(","));
    const decoded = vlqs.map((line) => line.map(decodeVlq));
    let sourceFileIndex = 0; // second field
    let sourceCodeLine = 0; // third field
    let sourceCodeColumn = 0; // fourth field

    const sourceMap = decoded.map((line) => {
      let generatedCodeColumn = 0; // first field - reset each time

      return line.map((segment) => {
        if (segment.some((x) => isNaN(x))) {
          throw new Error(`nan: ${segment}`);
        }
        generatedCodeColumn += segment[0];
        sourceFileIndex += segment[1];
        sourceCodeLine += segment[2];
        sourceCodeColumn += segment[3];

        const result: [
          file: number,
          index: number,
          line: number,
          column: number
        ] = [
          generatedCodeColumn,
          sourceFileIndex,
          sourceCodeLine,
          sourceCodeColumn,
        ];

        return result;
      });
    });
    return (line: number) => {
      const srcLine = sourceMap[line]?.[0]?.[2];
      if (srcLine === undefined) {
        return undefined;
      }
      return {
        line: srcLine,
        file: srcFilename.replace(`node_modules/${pkgName}/`, ""),
      };
    };
  });

  return {
    ...getDocsInfo(
      rootSymbols,
      pkgPath,
      pkgName,
      version,
      program,
      (symbolId) => externalSymbols.get(symbolId),
      (distFilename, line) => {
        const map = getSourceMap(distFilename);
        if (map === undefined) {
          return undefined;
        }
        return map(line);
      }
    ),
    versions: [...versions].reverse(),
  };
}

function memoize<Arg, Return>(fn: (arg: Arg) => Return): (arg: Arg) => Return {
  const cache = new Map<Arg, Return>();
  return (arg) => {
    if (cache.has(arg)) {
      return cache.get(arg)!;
    }
    const ret = fn(arg);
    cache.set(arg, ret);
    return ret;
  };
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
    const { goodIdentifiers } = getDocsInfo(
      rootSymbols,
      pkgPath,
      dep,
      version,
      program
    );
    for (const [symbolId, identifier] of Object.entries(goodIdentifiers)) {
      externalPackages.set(symbolId as SymbolId, {
        version,
        pkg: dep,
        id: identifier,
      });
    }
  }
  return externalPackages;
}

export function collectUnresolvedPackages(
  entrypoints: Map<string, string>,
  compilerOptions: ts.CompilerOptions,
  moduleResolutionHost: ts.ModuleResolutionHost,
  moduleResolutionCache: ts.ModuleResolutionCache
) {
  const collectedPackages = new Set<string>();
  const queue = new Set(entrypoints.values());
  for (const filepath of queue) {
    const content = moduleResolutionHost.readFile(filepath);
    if (content === undefined) {
      throw new Error("expected to be able to read ");
    }
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

      const resolved = ts.resolveModuleName(
        reference.fileName,
        filepath,
        compilerOptions,
        moduleResolutionHost,
        moduleResolutionCache
      ).resolvedModule?.resolvedFileName;
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
      return fileSystem
        .readDirSync(dirName)
        .filter((x) => fileSystem.directoryExistsSync(x))
        .map((x) => getBaseFileName(x));
    },
    realpath: (path) => fileSystem.realpathSync(path),
  };
}
