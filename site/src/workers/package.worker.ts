/// <reference lib="webworker" />

import { getPackage } from "../npm";
import { redirectToPkgVersion } from "../npm/version-redirect";
import type { WorkerResponse } from "./rpc";
import { errorMessage } from "./rpc";
import type { PackageWorkerRequest, PackageWorkerResponse } from "./data";

const docsRequests = new Map<
  string,
  Promise<Awaited<ReturnType<typeof getPackage>>>
>();

function getCachedPackage(pkg: string, version: string) {
  const packageRef = `${pkg}@${version}`;
  const existing = docsRequests.get(packageRef);
  if (existing !== undefined) return existing;

  const request = getPackage(pkg, version).catch((error: unknown) => {
    docsRequests.delete(packageRef);
    throw error;
  });
  docsRequests.set(packageRef, request);
  return request;
}

async function loadPackageDocs(splat: string): Promise<PackageWorkerResponse> {
  const resolution = await redirectToPkgVersion(splat.split("/"), "/npm");
  if (resolution.kind !== "pkg") return resolution;
  if (resolution.restParams.length) return { kind: "not-found" };
  return {
    kind: "data",
    value: await getCachedPackage(resolution.pkg, resolution.version),
  };
}

self.addEventListener(
  "message",
  async (
    event: MessageEvent<{ id: number; request: PackageWorkerRequest }>,
  ) => {
    let response: WorkerResponse<PackageWorkerResponse>;
    try {
      response = {
        id: event.data.id,
        ok: true,
        value: await loadPackageDocs(event.data.request.splat),
      };
    } catch (error) {
      response = { id: event.data.id, ok: false, error: errorMessage(error) };
    }
    self.postMessage(response);
  },
);
