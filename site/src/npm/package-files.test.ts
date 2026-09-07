import { expect, test } from "vitest";
import { ts } from "../extract/ts";
import { isPackageCompilerFile } from "./package-files";
import { collectEntrypointsOfPackage } from "./utils";

test.each([
  "package.json",
  "index.ts",
  "index.tsx",
  "index.mts",
  "index.cts",
  "index.d.ts",
  "index.d.mts",
  "index.d.cts",
  "index.d.ts.map",
  "index.d.mts.map",
  "index.d.cts.map",
])("retains %s for TypeScript", (filename) => {
  expect(isPackageCompilerFile(filename)).toBe(true);
});

test.each(["index.js", "index.mjs", "index.cjs", "README.md", "logo.png"])(
  "does not retain %s for TypeScript",
  (filename) => {
    expect(isPackageCompilerFile(filename)).toBe(false);
  },
);

test("resolves declarations beside a conditional ESM export", () => {
  const packagePath = "/node_modules/graphql";
  const files = new Map<string, string>([
    [
      `${packagePath}/package.json`,
      JSON.stringify({
        name: "graphql",
        types: "index.d.ts",
        exports: {
          ".": {
            default: {
              module: "./index.mjs",
              default: "./index.mjs",
            },
          },
        },
      }),
    ],
    [`${packagePath}/index.d.mts`, "export declare const version: string;"],
  ]);
  const host: ts.ModuleResolutionHost = {
    fileExists: (filename) => files.has(filename),
    readFile: (filename) => files.get(filename),
    directoryExists: (directory) =>
      directory === "/" ||
      directory === "/node_modules" ||
      directory === packagePath,
    getDirectories: () => [],
    getCurrentDirectory: () => "/",
    realpath: (path) => path,
    useCaseSensitiveFileNames: true,
  };
  const compilerOptions: ts.CompilerOptions = {
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext,
  };

  expect(
    collectEntrypointsOfPackage(
      "graphql",
      packagePath,
      compilerOptions,
      host,
      ts.createModuleResolutionCache("/", (path) => path, compilerOptions),
    ),
  ).toEqual(new Map([["graphql", `${packagePath}/index.d.mts`]]));
});
