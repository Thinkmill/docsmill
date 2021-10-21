export function getPkgWithVersionPortionOfParms(
  params: string | string[] | undefined
) {
  if (!Array.isArray(params)) {
    throw new Error("expected params to be array");
  }
  if (params[0].startsWith("@")) {
    return `${params[0]}/${params[1]}`;
  }
  return params[0];
}
