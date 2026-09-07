import isRangeValid from "semver/ranges/valid";
import maxSatisfyingVersion from "semver/ranges/max-satisfying";
import type { PackageMetadata } from "./fetch-package-metadata";

export function resolveToPackageVersion(
  pkg: PackageMetadata,
  specifier: string | undefined,
): string {
  if (specifier !== undefined) {
    if (Object.prototype.hasOwnProperty.call(pkg.tags, specifier)) {
      return pkg.tags[specifier];
    }
    if (isRangeValid(specifier)) {
      const version = maxSatisfyingVersion(pkg.versions, specifier);
      if (version) return version;
    }
  }
  return pkg.tags.latest;
}
