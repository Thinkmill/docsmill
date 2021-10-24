import { ts } from "@ts-morph/bootstrap";
import semver from "semver";
import { PackageMetadata } from "./fetch-package-metadata";
import { combinePaths } from "../extract/path";

function findPackageJsons(
  host: ts.ModuleResolutionHost,
  dir: string,
  found: Set<string>
) {
  const queue = new Set([dir]);
  for (const dir of queue) {
    if (host.fileExists(combinePaths(dir, "package.json"))) {
      found.add(`${dir}/package.json`);
    }
    for (const entry of host.getDirectories!(dir)) {
      if (entry === "node_modules") {
        continue;
      }
      queue.add(combinePaths(dir, entry));
      continue;
    }
  }
}

export function collectEntrypointsOfPackage(
  pkgName: string,
  pkgPath: string,
  compilerOptions: ts.CompilerOptions,
  host: ts.ModuleResolutionHost,
  cache: ts.ModuleResolutionCache
) {
  const packageJsons = new Set<string>();
  findPackageJsons(host, pkgPath, packageJsons);
  const entrypoints = new Map<string, string>();
  const fileToResolveFrom = combinePaths(
    host.getCurrentDirectory!(),
    "index.ts"
  );
  for (const x of packageJsons) {
    const resolved = ts.resolveModuleName(
      x.replace(/\/?package\.json$/, ""),
      fileToResolveFrom,
      compilerOptions,
      host,
      cache
    ).resolvedModule?.resolvedFileName;
    if (!resolved) continue;
    const entrypoint = `${pkgName}${x
      .replace(pkgPath, "")
      .replace(/\/?package\.json$/, "")}`;
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
