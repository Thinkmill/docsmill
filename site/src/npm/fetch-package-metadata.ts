export type PackageMetadata = {
  versions: string[];
  tags: Record<string, string>;
};

export async function getPackageMetadata(
  packageName: string
): Promise<PackageMetadata | undefined> {
  const res = await fetch(`https://registry.npmjs.org/${packageName}`, {
    headers: {
      Accept:
        "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8",
    },
  });
  if (res.status === 404) {
    return undefined;
  }
  return res.json().then((data) => {
    return {
      versions: Object.keys(data.versions),
      tags: data["dist-tags"],
    };
  });
}
