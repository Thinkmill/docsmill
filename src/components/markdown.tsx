/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import ReactMarkdown, { Options as ReactMarkdownOptions } from "react-markdown";
import Highlight, { Prism } from "prism-react-renderer";
import { codeFont, colors } from "../lib/theme.css";
import { getExternalSymbolUrl, SymbolReference } from "./symbol-references";
import { useDocsContext } from "../lib/DocsContext";
import remarkGfm from "remark-gfm";
import * as styles from "./markdown.css";
import Link from "next/link";
import { nonRootSymbolReference } from "./symbol-references.css";
import { SymbolId } from "../lib/types";

export function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      children={content}
      components={components}
    />
  );
}

const theme = {
  plain: {
    color: colors.coolGray600,
    backgroundColor: colors.gray50,
  },
  styles: [
    { types: ["class-name"], style: { color: colors.lightBlue700 } },
    { types: ["changed"], style: { color: colors.cyan400 } },
    { types: ["deleted"], style: { color: colors.red400 } },
    { types: ["inserted", "attr-name"], style: { color: colors.teal500 } },
    { types: ["comment"], style: { color: colors.blueGray500 } },
    {
      types: ["builtin", "char", "constant", "url"],
      style: { color: colors.teal700 },
    },
    { types: ["string"], style: { color: colors.pink400 } },
    { types: ["variable"], style: { color: colors.rose500 } },
    { types: ["number"], style: { color: colors.pink600 } },
    { types: ["punctuation"], style: { color: colors.blueGray400 } },
    {
      types: ["function", "selector", "doctype"],
      style: { color: colors.coolGray700 },
    },
    { types: ["tag"], style: { color: colors.fuchsia500 } },
    { types: ["operator"], style: { color: colors.blueGray400 } },
    {
      types: ["property", "keyword", "namespace"],
      style: { color: colors.lightBlue500 },
    },
    { types: ["boolean"], style: { color: colors.rose500 } },
  ],
};

const components: ReactMarkdownOptions["components"] = {
  code: function CodeElement(props) {
    if (props.inline) {
      return <code css={codeFont}>{props.children}</code>;
    }
    return (
      <pre css={styles.codeblock}>
        <Highlight
          Prism={Prism}
          code={props.children.join("").trim()}
          language="tsx"
          theme={theme}
        >
          {({
            className,
            style,
            tokens: tokens,
            getLineProps,
            getTokenProps,
          }) => {
            return (
              <div
                className={className}
                css={styles.codeblockInner}
                style={style}
              >
                {tokens.map((line, i) => {
                  return (
                    <div key={i} {...getLineProps({ line, key: i })}>
                      {line.map((token, key) => {
                        // Fix for document field import
                        if (
                          token.content === "document" &&
                          token.types[0] === "imports"
                        ) {
                          token.types = ["imports"];
                        }
                        // Fix for `type:` property
                        if (token.content === "type") {
                          token.types = ["plain"];
                        }
                        return (
                          <span key={key} {...getTokenProps({ token, key })} />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          }}
        </Highlight>
      </pre>
    );
  },
  a: function MarkdownLink(props) {
    let href = ((props.node.properties as any).href as string) || "";
    const { symbols, goodIdentifiers, externalSymbols } = useDocsContext();
    const fullName = href.replace("#symbol-", "") as SymbolId;
    const text =
      props.node.children.length === 1 && props.node.children[0].type === "text"
        ? props.node.children[0].value
        : undefined;
    if (text) {
      if (symbols[fullName] && text === symbols[fullName][0].name) {
        return (
          <SymbolReference name={symbols[fullName][0].name} id={fullName} />
        );
      }
      const external = externalSymbols[fullName];
      if (
        external &&
        text === externalSymbols[fullName].id.match(/\.([^\.]+)$/)?.[1]
      ) {
        return (
          <span css={codeFont}>
            <Link href={getExternalSymbolUrl(external)}>
              <a css={nonRootSymbolReference}>{text}</a>
            </Link>
          </span>
        );
      }
    }

    if (symbols[fullName]) {
      href = `#${goodIdentifiers[fullName]}`;
    }
    const external = externalSymbols[fullName];
    if (external) {
      return (
        <Link href={getExternalSymbolUrl(external)}>
          <a css={styles.a}>{props.children}</a>
        </Link>
      );
    }
    return (
      <a css={styles.a} href={href}>
        {props.children}
      </a>
    );
  },
};
