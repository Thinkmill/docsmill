import isValidSemverVersion from "semver/functions/valid";
import { getPackageMetadata } from "./fetch-package-metadata";
import { resolveToPackageVersion } from "./resolve-package-version";

export async function redirectToPkgVersion(
  _pkgParam: string[] | undefined | string,
  root: string,
): Promise<
  | { kind: "not-found" }
  | { kind: "redirect"; destination: string }
  | { kind: "pkg"; pkg: string; version: string; restParams: string[] }
> {
  if (!_pkgParam || typeof _pkgParam === "string" || !_pkgParam.length) {
    return { kind: "not-found" };
  }
  const pkgParam = [..._pkgParam];
  let pkgWithVersion = pkgParam.shift()!;
  if (pkgWithVersion[0] === "@") {
    const nameComponent = pkgParam.shift()!;
    if (!nameComponent) {
      return { kind: "not-found" };
    }
    pkgWithVersion = `${pkgWithVersion}/${nameComponent}`;
  }
  const match = pkgWithVersion.match(/^(@?[^@]+)(?:@(.+))?/);
  if (!match) return { kind: "not-found" };
  const [, pkgName, specifier] = match;

  if (!specifier || !isValidSemverVersion(specifier)) {
    const pkg = await getPackageMetadata(pkgName);
    if (pkg === undefined) {
      return { kind: "not-found" };
    }
    const version = resolveToPackageVersion(pkg, specifier);
    return {
      kind: "redirect",
      destination: `${root}/${pkgName}@${version}${
        pkgParam.length ? `/${pkgParam.join("/")}` : ""
      }`,
    };
  }
  return {
    kind: "pkg",
    pkg: pkgName,
    version: specifier,
    restParams: pkgParam,
  };
}
