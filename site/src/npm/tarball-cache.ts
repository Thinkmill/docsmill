const tarballCacheName = "docsmill-npm-tarballs-v1";

// https://github.com/pnpm/get-npm-tarball-url
export function getNpmTarballUrl(
  packageName: string,
  packageVersion: string,
): string {
  const scopelessName = packageName.startsWith("@")
    ? packageName.split("/")[1]
    : packageName;
  const buildMetadataPosition = packageVersion.indexOf("+");
  const version =
    buildMetadataPosition === -1
      ? packageVersion
      : packageVersion.slice(0, buildMetadataPosition);
  return `https://registry.npmjs.org/${packageName}/-/${scopelessName}-${version}.tgz`;
}

export async function cachePackageTarball(
  packageName: string,
  packageVersion: string,
  response: Response,
): Promise<void> {
  if (!("caches" in globalThis)) return;

  try {
    const cache = await globalThis.caches.open(tarballCacheName);
    await cache.put(getNpmTarballUrl(packageName, packageVersion), response);
  } catch {
    // Cache Storage can be unavailable or over quota. Documentation generation
    // should still succeed; Source will use its existing CDN fallback.
  }
}

export async function getCachedPackageTarball(
  packageName: string,
  packageVersion: string,
): Promise<Response | undefined> {
  if (!("caches" in globalThis)) return undefined;

  try {
    const cache = await globalThis.caches.open(tarballCacheName);
    return await cache.match(getNpmTarballUrl(packageName, packageVersion));
  } catch {
    return undefined;
  }
}
