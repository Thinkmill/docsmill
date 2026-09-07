const allLibFiles = require("@ts-morph/common").getLibFiles();
const ts = require("@typescript/typescript6");
const compilerLibFileNames = require("./compiler-lib-files.json");

function selectReferencedLibFiles(libFiles, roots) {
  const filesByName = new Map(libFiles.map((file) => [file.fileName, file]));
  const selectedNames = new Set();
  const pendingNames = [...roots];

  while (pendingNames.length !== 0) {
    const fileName = pendingNames.pop();
    if (selectedNames.has(fileName)) continue;

    const file = filesByName.get(fileName);
    if (file === undefined) {
      throw new Error(`TypeScript library file not found: ${fileName}`);
    }
    selectedNames.add(fileName);

    for (const match of file.text.matchAll(
      /\/\/\/ <reference lib="([^"]+)"/g,
    )) {
      pendingNames.push(`lib.${match[1].toLowerCase()}.d.ts`);
    }
  }

  return libFiles.filter((file) => selectedNames.has(file.fileName));
}

function stripComments(fileName, text) {
  if (!text.includes("/*")) return text;

  const sourceFile = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  return ts
    .createPrinter({
      newLine: ts.NewLineKind.LineFeed,
      removeComments: true,
    })
    .printFile(sourceFile);
}

require("fs").writeFileSync(
  "lib-files.json",
  JSON.stringify(
    selectReferencedLibFiles(allLibFiles, compilerLibFileNames).map(
      ({ fileName, text }) => ({
        fileName,
        text: stripComments(fileName, text),
      }),
    ),
  ),
);
