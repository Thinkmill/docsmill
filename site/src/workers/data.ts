import type { PackageDocInfo } from "../npm";
import type { Token } from "../components/highlight";

export type DataResult<T> =
  | { kind: "data"; value: T }
  | { kind: "not-found" }
  | { kind: "redirect"; destination: string };

export type PackageWorkerRequest = { splat: string };
export type PackageWorkerResponse = DataResult<PackageDocInfo>;

export type SourceEntry = string | [string, SourceEntry[]];

export type SourceData = {
  packageName: string;
  packageRef: string;
  version: string;
  versions: string[];
  entries: SourceEntry[];
  content: null | string | Token[][];
  filename: string;
};

export type SourceWorkerRequest = { splat: string };
export type SourceWorkerResponse = DataResult<SourceData>;
