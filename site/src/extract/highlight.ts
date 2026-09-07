import { createBrowserTreelight } from "@treelight/browser";
import githubLight from "@treelight/theme-github-light";
import type { Token } from "../components/highlight";
import { resolveLanguage, type Language } from "./highlight-languages";

export {
  languages,
  languagesInMarkdown,
  resolveLanguage,
} from "./highlight-languages";
export type { Language } from "./highlight-languages";

const languageLoaders = {
  css: () => import("@treelight/css/browser"),
  html: () => import("@treelight/html/browser"),
  javascript: () => import("@treelight/javascript/browser"),
  json: () => import("@treelight/json/browser"),
  markdown: () => import("@treelight/markdown/browser"),
  tsx: () => import("@treelight/tsx/browser"),
  typescript: () => import("@treelight/typescript/browser"),
} satisfies Record<Language, () => Promise<unknown>>;

export const extensionsToLang = new Map<string, Language>([
  ["css", "css"],
  ["html", "html"],
  ["js", "javascript"],
  ["jsx", "javascript"],
  ["json", "json"],
  ["md", "markdown"],
  ["ts", "typescript"],
  ["tsx", "tsx"],
  ["mjs", "javascript"],
  ["cjs", "javascript"],
  ["cts", "typescript"],
  ["mts", "typescript"],
]);

const highlighter = createBrowserTreelight({
  languages: Object.entries(languageLoaders),
  themes: [githubLight],
});

const loadedLanguages = new Set<Language>();

export async function loadLanguages(
  requestedLanguages: Iterable<string>,
): Promise<void> {
  await Promise.all(
    [...requestedLanguages].flatMap((language) => {
      const supportedLanguage = resolveLanguage(language);
      if (
        supportedLanguage === undefined ||
        loadedLanguages.has(supportedLanguage)
      ) {
        return [];
      }
      loadedLanguages.add(supportedLanguage);
      return highlighter
        .loadLanguage(supportedLanguage)
        .catch((error: unknown) => {
          loadedLanguages.delete(supportedLanguage);
          throw error;
        });
    }),
  );
}

function toTokens(lines: string[]): Token[][] {
  return lines.map((html) => [{ kind: "html", value: html }]);
}

export async function highlight(
  content: string,
  language: Language,
): Promise<Token[][]> {
  await loadLanguages([language]);
  return toTokens(
    highlighter.highlightLinesSync(content, language, {
      theme: "github-light",
    }),
  );
}

export function highlightLoaded(
  content: string,
  language: Language,
): Token[][] {
  return toTokens(
    highlighter.highlightLinesSync(content, language, {
      theme: "github-light",
    }),
  );
}
