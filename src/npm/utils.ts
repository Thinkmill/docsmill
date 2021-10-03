import { ts, FileSystemHost } from "@ts-morph/bootstrap";
import semver from "semver";
import path from "path";
import { PackageMetadata } from "./fetch-package-metadata";

export async function collectEntrypointsOfPackage(
  fileSystem: FileSystemHost,
  resolveBareSpecifier: (
    moduleName: string,
    containingFile: string
  ) => ts.ResolvedModuleWithFailedLookupLocations,
  pkgName: string,
  pkgPath: string
) {
  const packageJsons = new Set([
    `${pkgPath}/package.json`,
    ...(await fileSystem.glob([
      `${pkgPath}/**/package.json`,
      `!${pkgPath}/node_modules/**/package.json`,
    ])),
  ]);
  const entrypoints = new Map<string, string>();

  for (const x of packageJsons) {
    const entrypoint = path.join(
      pkgName,
      x.replace(pkgPath, "").replace(/\/?package\.json$/, "")
    );
    const resolved = resolveBareSpecifier(entrypoint, "/index.ts")
      .resolvedModule?.resolvedFileName;
    if (!resolved) continue;
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
