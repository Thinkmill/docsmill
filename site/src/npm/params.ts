export function getPkgWithVersionPortionOfParms(
  params: string | string[] | undefined,
) {
  if (!Array.isArray(params)) {
    throw new Error("expected params to be array");
  }
  if (params[0].startsWith("@")) {
    return `${params[0]}/${params[1]}`;
  }
  return params[0];
}

export function parsePackageRef(splat: string) {
  const segments = splat.split("/");
  let packageRef = segments.shift() ?? "";
  if (packageRef.startsWith("@") && segments.length !== 0) {
    packageRef += `/${segments.shift()}`;
  }

  const versionSeparator = packageRef.lastIndexOf("@");
  if (versionSeparator > 0) {
    return {
      packageName: packageRef.slice(0, versionSeparator),
      version: packageRef.slice(versionSeparator + 1) || "latest",
    };
  }
  return { packageName: packageRef, version: "latest" };
}
