export const languageNames = [
  "css",
  "html",
  "javascript",
  "json",
  "markdown",
  "tsx",
  "typescript",
] as const;

export type Language = (typeof languageNames)[number];

const languageAliases = new Map<string, Language>([
  ...languageNames.map(
    (language) => [language, language] as [Language, Language],
  ),
  ["js", "javascript"],
  ["jsx", "javascript"],
  ["md", "markdown"],
  ["ts", "typescript"],
]);

export const languages = new Set(languageAliases.keys());

export function resolveLanguage(language: string): Language | undefined {
  return languageAliases.get(language.toLowerCase());
}

export function languagesInMarkdown(content: string): Set<Language> {
  const found = new Set<Language>();
  let openFence: string | undefined;
  for (const line of content.split(/\r?\n/)) {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (match === null) continue;

    const marker = match[1];
    const info = match[2].trim();
    if (openFence !== undefined) {
      if (
        marker[0] === openFence[0] &&
        marker.length >= openFence.length &&
        info === ""
      ) {
        openFence = undefined;
      }
      continue;
    }

    openFence = marker;
    const language = resolveLanguage(info.split(/\s+/, 1)[0] || "tsx");
    if (language !== undefined) found.add(language);
  }
  return found;
}
