/// <reference lib="webworker" />

import { extensionsToLang, highlight } from "../extract/highlight";
import { getPackageMetadata } from "../npm/fetch-package-metadata";
import { redirectToPkgVersion } from "../npm/version-redirect";
import { getCachedPackageTarball } from "../npm/tarball-cache";
import type { SourceTarball } from "../npm/source-tarball";
import type {
  SourceData,
  SourceEntry,
  SourceWorkerRequest,
  SourceWorkerResponse,
} from "./data";
import type { WorkerResponse } from "./rpc";
import { errorMessage } from "./rpc";

type InputFile = { name: string; type: "file" };
type InputDirectory = {
  name: string;
  type: "directory";
  files: (InputFile | InputDirectory)[];
};

const directoryRequests = new Map<string, Promise<SourceEntry[]>>();
const contentRequests = new Map<string, Promise<SourceData["content"]>>();
const tarballRequests = new Map<string, Promise<SourceTarball | undefined>>();

function transformDirectory(directory: InputDirectory): SourceEntry[] {
  return directory.files
    .sort((a, b) => {
      if (a.type === "directory" && b.type === "file") return -1;
      if (a.type === "file" && b.type === "directory") return 1;
      return a.name.localeCompare(b.name);
    })
    .map((entry): SourceEntry =>
      entry.type === "directory"
        ? [entry.name, transformDirectory(entry)]
        : entry.name,
    );
}

function getDirectory(packageRef: string): Promise<SourceEntry[]> {
  const existing = directoryRequests.get(packageRef);
  if (existing !== undefined) return existing;

  const request = fetch(
    `https://data.jsdelivr.com/v1/package/npm/${packageRef}`,
  )
    .then((response) => response.json() as Promise<InputDirectory>)
    .then(transformDirectory)
    .catch((error: unknown) => {
      directoryRequests.delete(packageRef);
      throw error;
    });
  directoryRequests.set(packageRef, request);
  return request;
}

function getContent(
  packageRef: string,
  filename: string,
): Promise<SourceData["content"]> {
  const key = `${packageRef}/${filename}`;
  const existing = contentRequests.get(key);
  if (existing !== undefined) return existing;

  const request = fetch(`https://cdn.jsdelivr.net/npm/${key}`)
    .then(async (response): Promise<SourceData["content"]> => {
      if (response.status === 404) return null;
      const text = await response.text();
      return transformContent(text, filename);
    })
    .catch((error: unknown) => {
      contentRequests.delete(key);
      throw error;
    });
  contentRequests.set(key, request);
  return request;
}

function transformContent(
  text: string,
  filename: string,
): Promise<SourceData["content"]> | SourceData["content"] {
  const extension = filename.match(/\.([^.]+)$/)?.[1];
  const language = extensionsToLang.get(extension || "");
  return language === undefined ? text : highlight(text, language);
}

function getTarball(
  packageName: string,
  version: string,
): Promise<SourceTarball | undefined> {
  const packageRef = `${packageName}@${version}`;
  const existing = tarballRequests.get(packageRef);
  if (existing !== undefined) return existing;

  const request = getCachedPackageTarball(packageName, version)
    .then(async (response) => {
      if (response?.body === null || response === undefined) return undefined;
      const { extractSourceTarball } = await import("../npm/source-tarball");
      return extractSourceTarball(response.body);
    })
    .catch(() => {
      // A corrupt or unreadable cached response should not break Source.
      // The existing jsDelivr path remains the fallback.
      return undefined;
    });
  tarballRequests.set(packageRef, request);
  return request;
}

async function loadSource(splat: string): Promise<SourceWorkerResponse> {
  const resolution = await redirectToPkgVersion(splat.split("/"), "/src");
  if (resolution.kind !== "pkg") return resolution;

  const filename = resolution.restParams.join("/");
  const packageRef = `${resolution.pkg}@${resolution.version}`;
  const pkgMetadataPromise = getPackageMetadata(resolution.pkg);
  const tarball = await getTarball(resolution.pkg, resolution.version);
  const [pkgMetadata, entries, content] = await Promise.all([
    pkgMetadataPromise,
    tarball?.entries ?? getDirectory(packageRef),
    resolution.restParams.length === 0
      ? null
      : tarball?.files.has(filename)
        ? transformContent(tarball.files.get(filename)!, filename)
        : getContent(packageRef, filename),
  ]);

  if (pkgMetadata === undefined) return { kind: "not-found" };
  const value: SourceData = {
    packageName: resolution.pkg,
    packageRef,
    version: resolution.version,
    versions: pkgMetadata.versions,
    entries,
    content,
    filename,
  };
  return { kind: "data", value };
}

self.addEventListener(
  "message",
  async (event: MessageEvent<{ id: number; request: SourceWorkerRequest }>) => {
    let response: WorkerResponse<SourceWorkerResponse>;
    try {
      response = {
        id: event.data.id,
        ok: true,
        value: await loadSource(event.data.request.splat),
      };
    } catch (error) {
      response = { id: event.data.id, ok: false, error: errorMessage(error) };
    }
    self.postMessage(response);
  },
);
