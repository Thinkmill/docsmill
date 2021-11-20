import { GetStaticPropsResult } from "next";
import isValidSemverVersion from "semver/functions/valid";
import isRangeValid from "semver/ranges/valid";
import maxSatisfyingVersion from "semver/ranges/max-satisfying";
import { getPackageMetadata, PackageMetadata } from "./fetch-package-metadata";

export function resolveToPackageVersion(
  pkg: PackageMetadata,
  specifier: string | undefined
): string {
  if (specifier !== undefined) {
    if (Object.prototype.hasOwnProperty.call(pkg.tags, specifier)) {
      return pkg.tags[specifier];
    }
    if (isRangeValid(specifier)) {
      const version = maxSatisfyingVersion(pkg.versions, specifier);
      if (version) {
        return version;
      }
    }
  }
  return pkg.tags.latest;
}

export async function redirectToPkgVersion(
  _pkgParam: string[] | undefined | string,
  root: string
): Promise<
  | { kind: "handled"; result: GetStaticPropsResult<never> }
  | { kind: "pkg"; pkg: string; version: string; restParams: string[] }
> {
  if (!_pkgParam || typeof _pkgParam === "string" || !_pkgParam.length) {
    return {
      kind: "handled",
      result: { notFound: true },
    };
  }
  const pkgParam = [..._pkgParam];
  let pkgWithVersion = pkgParam.shift()!;
  if (pkgWithVersion[0] === "@") {
    const nameComponent = pkgParam.shift()!;
    if (!nameComponent) {
      return { kind: "handled", result: { notFound: true } };
    }
    pkgWithVersion = `${pkgWithVersion}/${nameComponent}`;
  }
  const [, pkgName, specifier] = pkgWithVersion.match(/^(@?[^@]+)(?:@(.+))?/)!;

  if (!specifier || !isValidSemverVersion(specifier)) {
    const pkg = await getPackageMetadata(pkgName);
    if (pkg === undefined) {
      return { kind: "handled", result: { notFound: true } };
    }
    const version = resolveToPackageVersion(pkg, specifier);
    return {
      kind: "handled",
      result: {
        redirect: {
          statusCode: 307,
          destination: `${root}/${pkgName}@${version}${pkgParam.join("/")}`,
        },
        revalidate: 60 * 20,
      },
    };
  }
  return {
    kind: "pkg",
    pkg: pkgName,
    version: specifier,
    restParams: pkgParam,
  };
}
