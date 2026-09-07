import { extract } from "it-tar";
import type { SourceEntry } from "../workers/data";

type DirectoryNode = {
  directories: Map<string, DirectoryNode>;
  files: Set<string>;
};

export type SourceTarball = {
  entries: SourceEntry[];
  files: Map<string, string>;
};

async function* streamToIterator(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

function packagePath(tarPath: string): string | undefined {
  const path = tarPath.replace(/^[^/]+\/?/, "");
  const parts = path.split("/").filter((part) => part !== "" && part !== ".");
  if (parts.length === 0 || parts.includes("..")) return undefined;
  return parts.join("/");
}

function addFile(root: DirectoryNode, path: string): void {
  const parts = path.split("/");
  const filename = parts.pop();
  if (filename === undefined) return;

  let directory = root;
  for (const part of parts) {
    let child = directory.directories.get(part);
    if (child === undefined) {
      child = { directories: new Map(), files: new Set() };
      directory.directories.set(part, child);
    }
    directory = child;
  }
  directory.files.add(filename);
}

function toSourceEntries(directory: DirectoryNode): SourceEntry[] {
  return [
    ...[...directory.directories]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, child]): SourceEntry => [name, toSourceEntries(child)]),
    ...[...directory.files].sort((a, b) => a.localeCompare(b)),
  ];
}

export async function extractSourceTarball(
  tarballStream: ReadableStream<Uint8Array>,
): Promise<SourceTarball> {
  const uncompressed = tarballStream.pipeThrough(
    new DecompressionStream("gzip") as unknown as TransformStream<
      Uint8Array,
      Uint8Array
    >,
  );
  const root: DirectoryNode = { directories: new Map(), files: new Set() };
  const files = new Map<string, string>();

  for await (const { header, body } of extract()(
    streamToIterator(uncompressed),
  )) {
    if (header.type !== "file") {
      for await (const _ of body) {
      }
      continue;
    }

    const path = packagePath(header.name);
    if (path === undefined) {
      for await (const _ of body) {
      }
      continue;
    }
    addFile(root, path);

    const decoder = new TextDecoder("utf-8", { fatal: true });
    let content = "";
    let isText = true;
    for await (const chunk of body) {
      if (!isText) continue;
      if (chunk.includes(0)) {
        isText = false;
        content = "";
        continue;
      }
      try {
        content += decoder.decode(chunk, { stream: true });
      } catch {
        isText = false;
        content = "";
      }
    }
    if (isText) {
      try {
        content += decoder.decode();
        files.set(path, content);
      } catch {
        // Keep the entry in the tree, but let binary/invalid UTF-8 content use
        // the CDN fallback if it is selected.
      }
    }
  }

  return { entries: toSourceEntries(root), files };
}
