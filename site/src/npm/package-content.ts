import { createGunzip } from "zlib";
import { getNpmTarballUrl } from "./get-npm-tarball-url";
import tar from "tar-stream";

function streamToString(stream: NodeJS.ReadableStream) {
  return new Promise<string>((resolve, reject) => {
    let content = "";
    stream.setEncoding("utf-8");
    stream
      .on("error", reject)
      .on("data", (chunk) => {
        content += chunk;
      })
      .on("end", () => resolve(content));
  });
}

async function getTarballStream(pkgName: string, pkgVersion: string) {
  const tarballStream = await fetch(getNpmTarballUrl(pkgName, pkgVersion)).then(
    (res) => res.body!
  );
  return (tarballStream as unknown as NodeJS.ReadableStream)
    .pipe(createGunzip())
    .pipe(tar.extract());
}

async function extractTypeScriptishFilesFromTarball(extract: tar.Extract) {
  const entries = new Map<string, string>();
  extract.on("entry", (headers, stream, next) => {
    if (
      headers.type !== "file" ||
      !/\.(json|ts|tsx|d\.ts\.map)$/.test(headers.name)
    ) {
      stream.resume();
      stream.on("end", next);
      return;
    }

    streamToString(stream)
      .then((content) => {
        entries.set(headers.name.replace(/^[^/]+\/?/, "/"), content);
        next();
      })
      .catch((err) => (next as any)(err));
  });

  return new Promise<Map<string, string>>((resolve, reject) => {
    extract.on("finish", () => {
      resolve(entries);
    });
    extract.on("error", (err) => {
      reject(err);
    });
  });
}

export async function fetchPackageContent(pkgName: string, pkgVersion: string) {
  const tarballStream = await getTarballStream(pkgName, pkgVersion);
  return extractTypeScriptishFilesFromTarball(tarballStream);
}

function extractSingleFileFromTarball(
  extract: tar.Extract,
  filePath: string
): Promise<{ entries: string[]; content: string | null }> {
  const entries: string[] = [];
  let contentForFilepath: string | null = null;
  extract.on("entry", (headers, stream, next) => {
    if (headers.type !== "file") {
      stream.resume();
      stream.on("end", next);
      return;
    }
    const filepath = headers.name.replace(/^[^/]+\/?/, "/");
    entries.push(filepath);
    if (filepath.slice(1) !== filePath) {
      stream.resume();
      stream.on("end", next);
      return;
    }

    streamToString(stream)
      .then((content) => {
        contentForFilepath = content;
        next();
      })
      .catch((err) => (next as any)(err));
  });

  return new Promise((resolve, reject) => {
    extract.on("finish", () => {
      resolve({ entries, content: contentForFilepath });
    });
    extract.on("error", (err) => {
      reject(err);
    });
  });
}

export async function fetchSpecificPackageContent(
  pkgName: string,
  pkgVersion: string,
  filePath: string
) {
  const tarballStream = await getTarballStream(pkgName, pkgVersion);
  return extractSingleFileFromTarball(tarballStream, filePath);
}
