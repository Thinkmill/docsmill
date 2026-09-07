import { notFound, redirect } from "@tanstack/react-router";
import type { PackageDocInfo } from "../npm";
import type {
  DataResult,
  PackageWorkerRequest,
  PackageWorkerResponse,
  SourceData,
  SourceWorkerRequest,
  SourceWorkerResponse,
} from "./data";
import { createWorkerClient } from "./rpc";

const requestPackage = createWorkerClient<
  PackageWorkerRequest,
  PackageWorkerResponse
>(
  () =>
    new Worker(new URL("./package.worker.ts", import.meta.url), {
      type: "module",
    }),
);

const requestSource = createWorkerClient<
  SourceWorkerRequest,
  SourceWorkerResponse
>(
  () =>
    new Worker(new URL("./source.worker.ts", import.meta.url), {
      type: "module",
    }),
);

function unwrap<T>(result: DataResult<T>): T {
  if (result.kind === "not-found") throw notFound();
  if (result.kind === "redirect") {
    throw redirect({ href: result.destination, statusCode: 302 });
  }
  return result.value;
}

export async function loadPackageDocsInBrowser(
  splat: string,
): Promise<PackageDocInfo> {
  return unwrap(await requestPackage({ splat }));
}

export async function loadSourceInBrowser(splat: string): Promise<SourceData> {
  return unwrap(await requestSource({ splat }));
}
