import ts from "typescript";
import { resolvePath, getDirectoryPath } from "../extract/path";
import { memoize } from "./utils";
import { decode as decodeVlq } from "vlq";

export function getSourceMapHandler(
  compilerHost: ts.CompilerHost,
  pkgName: string
) {
  const getSourceMap = memoize((distFilename: string) => {
    let content = compilerHost.readFile(distFilename + ".map");
    if (content === undefined) {
      return undefined;
    }

    let sourceMapContent:
      | {
          sourceRoot: string;
          sources: [string];
          mappings: string;
        }
      | undefined;
    try {
      sourceMapContent = JSON.parse(content);
    } catch (err) {
      console.log(
        "could not parse source file content for ",
        distFilename + ".map"
      );
      return undefined;
    }
    sourceMapContent = sourceMapContent!;
    const sourceRoot = resolvePath(
      getDirectoryPath(distFilename),
      sourceMapContent.sourceRoot
    );
    const srcFilename = resolvePath(sourceRoot, sourceMapContent.sources[0]);

    if (!compilerHost.fileExists(srcFilename)) {
      console.log("source file for .d.ts.map not found", srcFilename);
      return undefined;
    }
    const vlqs = sourceMapContent.mappings
      .split(";")
      .map((line) => line.split(","));
    const decoded = vlqs.map((line) => line.map(decodeVlq));
    let sourceFileIndex = 0; // second field
    let sourceCodeLine = 0; // third field
    let sourceCodeColumn = 0; // fourth field

    const sourceMap = decoded.map((line) => {
      let generatedCodeColumn = 0; // first field - reset each time

      return line.map((segment) => {
        if (segment.length === 0) {
          return;
        }
        if (segment.some((x) => isNaN(x))) {
          throw new Error(`nan: ${segment}`);
        }
        generatedCodeColumn += segment[0];
        sourceFileIndex += segment[1];
        sourceCodeLine += segment[2];
        sourceCodeColumn += segment[3];

        const result: [
          file: number,
          index: number,
          line: number,
          column: number
        ] = [
          generatedCodeColumn,
          sourceFileIndex,
          sourceCodeLine,
          sourceCodeColumn,
        ];

        return result;
      });
    });
    return (line: number) => {
      const srcLine = sourceMap[line]?.[0]?.[2];
      if (srcLine === undefined) {
        return undefined;
      }
      return {
        line: srcLine,
        file: srcFilename.replace(`node_modules/${pkgName}/`, ""),
      };
    };
  });
  return (distFilename: string, line: number) => {
    const map = getSourceMap(distFilename);
    if (map === undefined) {
      return undefined;
    }
    return map(line);
  };
}
