export type PackageMetadata = {
  versions: string[];
  tags: Record<string, string>;
};

export async function getPackageMetadata(
  packageName: string
): Promise<PackageMetadata | undefined> {
  const res = await fetch(
    `https://data.jsdelivr.com/v1/package/npm/${packageName}`,
    { headers: { "User-Agent": "https://github.com/Thinkmill/docsmill" } }
  );
  if (res.status === 404) {
    return undefined;
  }
  return res.json();
}
