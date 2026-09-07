import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import { visit } from "unist-util-visit";
import { highlightLoaded, resolveLanguage } from "./highlight";

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype);

export function parseMarkdown(markdown: string): import("hast").Content[] {
  if (markdown.trim() === "") {
    return [];
  }

  const ast = processor.runSync(
    processor.parse(markdown),
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
          const language = resolveLanguage(className.replace("language-", ""));
          if (language !== undefined) {
            node.data = {
              tokens: highlightLoaded(node.children[0].value, language),
            } as unknown as import("hast").ElementData;

            node.children = [];
          }
        }
      }
      delete node.position;
    },
  );
  return ast.children as any;
}
