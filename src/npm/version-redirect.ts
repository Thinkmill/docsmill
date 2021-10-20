import { GetStaticPropsResult } from "next";
import semver from "semver";
import { getPackageMetadata } from "./fetch-package-metadata";
import { resolveToPackageVersion } from "./utils";

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

  if (!specifier || !semver.parse(specifier)) {
    const pkg = await getPackageMetadata(pkgName);
    const version = resolveToPackageVersion(pkg, specifier);
    return {
      kind: "handled",
      result: {
        redirect: {
          statusCode: 302,
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
