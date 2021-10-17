import { ts, FileSystemHost } from "@ts-morph/bootstrap";
import semver from "semver";
import path from "path";
import { PackageMetadata } from "./fetch-package-metadata";

function findPackageJsons(
  fileSystem: FileSystemHost,
  dir: string,
  found: Set<string>
) {
  const queue = new Set([dir]);
  for (const dir of queue) {
    for (const entry of fileSystem.readDirSync(dir)) {
      if (entry.endsWith("/node_modules")) {
        continue;
      }
      if (fileSystem.directoryExistsSync(entry)) {
        queue.add(entry);
        continue;
      }
      if (entry.endsWith("/package.json")) {
        found.add(entry);
      }
    }
  }
}

export async function collectEntrypointsOfPackage(
  fileSystem: FileSystemHost,
  resolveBareSpecifier: (
    moduleName: string,
    containingFile: string
  ) => ts.ResolvedModuleWithFailedLookupLocations,
  pkgName: string,
  pkgPath: string
) {
  const packageJsons = new Set<string>();
  findPackageJsons(fileSystem, pkgPath, packageJsons);
  const entrypoints = new Map<string, string>();

  for (const x of packageJsons) {
    const resolved = resolveBareSpecifier(
      x.replace(/\/?package\.json$/, ""),
      "/index.ts"
    ).resolvedModule?.resolvedFileName;
    if (!resolved) continue;
    const entrypoint = path.join(
      pkgName,
      x.replace(pkgPath, "").replace(/\/?package\.json$/, "")
    );
    entrypoints.set(entrypoint, resolved);
  }
  return entrypoints;
}

export function resolveToPackageVersion(
  pkg: PackageMetadata,
  specifier: string | undefined
): string {
  if (specifier !== undefined) {
    if (Object.prototype.hasOwnProperty.call(pkg.tags, specifier)) {
      return pkg.tags[specifier];
    }
    if (semver.validRange(specifier)) {
      const version = semver.maxSatisfying(pkg.versions, specifier);
      if (version) {
        return version;
      }
    }
  }
  return pkg.tags.latest;
}
