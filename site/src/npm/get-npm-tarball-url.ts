// https://github.com/pnpm/get-npm-tarball-url
export function getNpmTarballUrl(pkgName: string, pkgVersion: string): string {
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
