export type PackageMetadata = {
  versions: string[];
  tags: Record<string, string>;
};

const metadataRequests = new Map<
  string,
  Promise<PackageMetadata | undefined>
>();

async function fetchPackageMetadata(
  packageName: string,
): Promise<PackageMetadata | undefined> {
  const res = await fetch(
    `https://data.jsdelivr.com/v1/package/npm/${packageName}`,
  );
  if (res.status === 404) {
    return undefined;
  }
  return res.json();
}

export function getPackageMetadata(
  packageName: string,
): Promise<PackageMetadata | undefined> {
  const existing = metadataRequests.get(packageName);
  if (existing !== undefined) return existing;

  const request = fetchPackageMetadata(packageName).catch((error: unknown) => {
    metadataRequests.delete(packageName);
    throw error;
  });
  metadataRequests.set(packageName, request);
  return request;
}
