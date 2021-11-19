import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import { visit } from "unist-util-visit";
import { Highlighter, getHighlighter, Lang, FontStyle } from "shiki";

let highlighter: Highlighter | undefined;

// https://nextjs.org/docs/advanced-features/output-file-tracing
export function includeThingsInDeployment() {
  require.resolve("shiki/themes/github-light.json");
  require.resolve("shiki/languages/typescript.tmLanguage.json");
  require.resolve("shiki/languages/tsx.tmLanguage.json");
  require.resolve("shiki/languages/html.tmLanguage.json");
  require.resolve("shiki/languages/css.tmLanguage.json");
  require.resolve("shiki/languages/javascript.tmLanguage.json");
  require.resolve("shiki/languages/jsx.tmLanguage.json");
}

const langs: Lang[] = [
  "ts",
  "typescript",
  "tsx",
  "html",
  "css",
  "jsx",
  "javascript",
  "js",
  "ts",
];

const languages = new Set(langs);

export const highlighterPromise = getHighlighter({
  theme: "github-light",
  langs,
}).then((x) => {
  highlighter = x;
});

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype);

export function parseMarkdown(markdown: string): import("hast").Content[] {
  if (markdown.trim() === "") {
    return [];
  }

  const ast = processor.runSync(
    processor.parse(markdown)
  ) as import("hast").Root;
  visit(
    ast,
    () => true,
    (node, _index, parent) => {
      if (
        parent?.type === "element" &&
        parent.tagName === "pre" &&
        node.type === "element" &&
        node.tagName === "code" &&
        node.children.length === 1 &&
        node.children[0].type === "text" &&
        typeof node.children[0].value === "string"
      ) {
        const className = Array.isArray(node.properties?.className)
          ? node.properties?.className?.[0]
          : "language-tsx";
        if (typeof className === "string") {
          const lang = className.replace("language-", "");
          if (languages.has(lang as any)) {
            const tokens = highlighter!.codeToThemedTokens(
              node.children[0].value,
              lang
            );
            const mappedTokens = tokens.map((x) =>
              x.map((x) => {
                if (
                  x.fontStyle === FontStyle.NotSet ||
                  x.fontStyle === FontStyle.None ||
                  x.fontStyle === undefined
                ) {
                  return [x.content, x.color || null] as const;
                }
                return [x.content, x.color || null, x.fontStyle] as const;
              })
            );
            node.data = {
              tokens: mappedTokens,
            };

            node.children = [];
          }
        }
      }
      delete node.position;
    }
  );
  return ast.children as any;
}
