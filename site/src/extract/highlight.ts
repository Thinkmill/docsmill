import { Highlighter, getHighlighter, Lang, FontStyle } from "shiki";

export let highlighter: Highlighter | undefined;

// https://nextjs.org/docs/advanced-features/output-file-tracing
export function includeThingsInDeployment() {
  require.resolve("shiki/themes/github-light.json");
  require.resolve("shiki/languages/typescript.tmLanguage.json");
  require.resolve("shiki/languages/tsx.tmLanguage.json");
  require.resolve("shiki/languages/html.tmLanguage.json");
  require.resolve("shiki/languages/css.tmLanguage.json");
  require.resolve("shiki/languages/javascript.tmLanguage.json");
  require.resolve("shiki/languages/jsx.tmLanguage.json");
  require.resolve("shiki/languages/markdown.tmLanguage.json");
  require.resolve("shiki/languages/json.tmLanguage.json");
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
  "md",
  "markdown",
  "json",
];

export const extensionsToLang = new Map<string, Lang>([
  ...(
    ["ts", "tsx", "html", "css", "jsx", "js", "ts", "md", "json"] as const
  ).map((x) => [x, x] as const),
  ["mjs", "js"],
  ["cjs", "js"],
  ["cts", "ts"],
  ["mts", "ts"],
]);

export const languages = new Set<string>(langs);

export const highlighterPromise = getHighlighter({
  theme: "github-light",
  langs,
}).then((x) => {
  highlighter = x;
  return x;
});

export function highlight(content: string, lang: string) {
  const tokens = highlighter!.codeToThemedTokens(content, lang);
  return tokens.map((x) =>
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
}
