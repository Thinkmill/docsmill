import { ts } from "../extract/ts";
import { combinePaths } from "../extract/path";

function findPackageJsons(
  host: ts.ModuleResolutionHost,
  dir: string,
  found: Set<string>
) {
  const queue = new Set([dir]);
  for (const dir of queue) {
    const combined = combinePaths(dir, "package.json");
    if (host.fileExists(combined)) {
      found.add(combined);
    }
    for (const entry of host.getDirectories!(dir)) {
      if (entry === "node_modules") {
        continue;
      }
      queue.add(combinePaths(dir, entry));
      continue;
    }
  }
}

export function memoize<Arg, Return>(
  fn: (arg: Arg) => Return
): (arg: Arg) => Return {
  const cache = new Map<Arg, Return>();
  return (arg) => {
    if (cache.has(arg)) {
      return cache.get(arg)!;
    }
    const ret = fn(arg);
    cache.set(arg, ret);
    return ret;
  };
}

export function collectEntrypointsOfPackage(
  pkgName: string,
  pkgPath: string,
  compilerOptions: ts.CompilerOptions,
  host: ts.ModuleResolutionHost,
  cache: ts.ModuleResolutionCache
) {
  const packageJsons = new Set<string>();
  findPackageJsons(host, pkgPath, packageJsons);
  const entrypoints = new Map<string, string>();
  const fileToResolveFrom = combinePaths(
    host.getCurrentDirectory!(),
    "index.ts"
  );
  for (const x of packageJsons) {
    const resolved = ts.resolveModuleName(
      x.replace(/\/?package\.json$/, ""),
      fileToResolveFrom,
      compilerOptions,
      host,
      cache
    ).resolvedModule?.resolvedFileName;
    if (!resolved) continue;
    const entrypoint = `${pkgName}${x
      .replace(pkgPath, "")
      .replace(/\/?package\.json$/, "")}`;
    entrypoints.set(entrypoint, resolved);
  }
  return entrypoints;
}
