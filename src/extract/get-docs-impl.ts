import {
  getSymbolAtLocation,
  getAliasedSymbol,
  getSymbolIdentifier,
} from "./core/utils";
import { ts } from "./ts";

function getJsDocCommentTextMarkdown(
  comment: string | undefined | ts.NodeArray<ts.JSDocComment>,
  host: { program: ts.Program }
) {
  if (comment === undefined) {
    return "";
  }
  if (typeof comment === "string") {
    return comment;
  }

  return comment
    .map((x) => {
      if (ts.isJSDocLink(x) && x.name) {
        const symbol = getSymbolAtLocation(x.name, host);
        if (symbol) {
          const finalSymbol = getAliasedSymbol(symbol, host);

          return `[${
            x.text || finalSymbol.getName()
          }](#symbol-${getSymbolIdentifier(finalSymbol)})`;
        } else {
          console.log(
            "could not get symbol for link with text at:",
            x.getFullText(),
            x.getSourceFile().fileName
          );
        }
      }

      return x.text;
    })
    .join("");
}

function getDocsFromJSDocNodes(
  nodes: ts.JSDoc[],
  host: { program: ts.Program }
) {
  return nodes
    .map((x) => {
      let fromTags = (x.tags || [])
        .filter((x) => x.tagName.text !== "module")
        .map((x) => {
          return `@${x.tagName.text} — ${getJsDocCommentTextMarkdown(
            x.comment,
            host
          )}`;
        })
        .join("\n\n");
      if (fromTags) {
        fromTags = `\n\n${fromTags}`;
      }
      return getJsDocCommentTextMarkdown(x.comment, host) + fromTags;
    })
    .join("\n\n");
}

function getJsDocsFromSourceFile(decl: ts.Node) {
  const jsDocs: ts.JSDoc[] = [];
  decl.forEachChild((node) => {
    if (!!(node as any).jsDoc) {
      const nodes: ts.JSDoc[] = (node as any).jsDoc ?? [];
      for (const doc of nodes) {
        if (doc.tags?.some((tag) => tag.tagName.text === "module")) {
          jsDocs.push(doc);
        }
      }
    }
  });
  return jsDocs;
}

function getDocsImplBase(decl: ts.Node, host: { program: ts.Program }) {
  let nodes = ((decl as any).jsDoc ?? []) as ts.JSDoc[];
  return getDocsFromJSDocNodes(
    nodes.filter(
      (x) =>
        x.tags === undefined || x.tags.every((x) => x.tagName.text !== "module")
    ),
    host
  );
}

export function getDocsImpl(
  decl: ts.Node,
  host: { program: ts.Program }
): string {
  if (ts.isSourceFile(decl)) {
    let jsDocs = getJsDocsFromSourceFile(decl);

    // if you have a file that re-exports _everything_ from somewhere else
    // then look at that place for jsdocs since e.g. Preconstruct
    // generates a declaration file that re-exports from the actual place that might include a JSDoc comment
    if (jsDocs.length === 0) {
      let foundStar = false;
      let sourceFile: undefined | ts.SourceFile = undefined;

      for (const exportDecl of decl.statements) {
        if (
          exportDecl.modifiers?.some(
            (x) => x.kind === ts.SyntaxKind.ExportKeyword
          )
        ) {
          sourceFile = undefined;
          break;
        }
        if (!ts.isExportDeclaration(exportDecl)) {
          continue;
        }

        const file =
          exportDecl.moduleSpecifier &&
          ts.isStringLiteral(exportDecl.moduleSpecifier)
            ? getSymbolAtLocation(exportDecl.moduleSpecifier, host)
                ?.valueDeclaration
            : undefined;

        if (
          !file ||
          !ts.isSourceFile(file) ||
          (sourceFile && file !== sourceFile)
        ) {
          sourceFile = undefined;
          break;
        }
        sourceFile = file;
        if (exportDecl.exportClause === undefined) {
          foundStar = true;
        }
      }
      if (foundStar && sourceFile) {
        jsDocs = getJsDocsFromSourceFile(sourceFile);
      }
    }
    return getDocsFromJSDocNodes(jsDocs, host);
  }
  if (
    ts.isVariableDeclaration(decl) &&
    ts.isVariableDeclarationList(decl.parent) &&
    ts.isVariableStatement(decl.parent.parent) &&
    decl.parent.declarations[0] === decl
  ) {
    return (
      getDocsImplBase(decl.parent.parent, host) +
      "\n\n" +
      getDocsImplBase(decl, host)
    ).trim();
  }
  return getDocsImplBase(decl, host);
}
