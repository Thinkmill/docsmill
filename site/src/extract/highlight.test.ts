import { expect, test } from "vitest";
import { languagesInMarkdown, resolveLanguage } from "./highlight-languages";

test.each([
  ["ts", "typescript"],
  ["typescript", "typescript"],
  ["js", "javascript"],
  ["jsx", "javascript"],
  ["javascript", "javascript"],
  ["md", "markdown"],
  ["markdown", "markdown"],
  ["tsx", "tsx"],
] as const)("resolves the %s Markdown fence", (fence, expected) => {
  expect(resolveLanguage(fence)).toBe(expected);
});

test("finds canonical languages used by Markdown fences", () => {
  const markdown = [
    "```ts",
    "const value: string = 'yes'",
    "```",
    "```js",
    "const value = 'yes'",
    "```",
    "```md",
    "# nested markdown",
    "```",
  ].join("\n");

  expect([...languagesInMarkdown(markdown)]).toEqual([
    "typescript",
    "javascript",
    "markdown",
  ]);
});

test("treats an unlabeled Markdown fence as TSX", () => {
  expect([
    ...languagesInMarkdown(["```", "<Component />", "```"].join("\n")),
  ]).toEqual(["tsx"]);
});
