/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from "@emotion/react";
import { Options as ReactMarkdownOptions } from "react-markdown";
import { SymbolReference } from "./symbol-references";
import { Link } from "@tanstack/react-router";
import { useDocsContext } from "../lib/DocsContext";
import * as styles from "./markdown.css";
import { nonRootSymbolReference } from "./symbol-references.css";
import { SymbolId } from "@docsmill/types";
import { Syntax, codeFont } from "./core";
import { isTokens, Line } from "./highlight";

export const markdownComponents: ReactMarkdownOptions["components"] = {
  pre: function PreElement(props) {
    const codeNode = props.node?.children[0];
    const allTokens =
      codeNode?.type === "element"
        ? (codeNode.data as { tokens?: unknown } | undefined)?.tokens
        : undefined;
    if (isTokens(allTokens)) {
      return (
        <pre css={styles.codeblock}>
          <code css={styles.codeblockInner}>
            {allTokens.map((tokens, i) => {
              return (
                <div key={i}>
                  <Line tokens={tokens} />
                </div>
              );
            })}
          </code>
        </pre>
      );
    }
    return (
      <pre css={styles.codeblock}>
        <code css={styles.codeblockInner}>{props.children}</code>
      </pre>
    );
  },
  code: function CodeElement(props) {
    return <code css={codeFont}>{props.children}</code>;
  },
  a: function MarkdownLink(props) {
    let href = props.href || "";
    const { symbols, goodIdentifiers, externalSymbols } = useDocsContext();
    const fullName = href.replace("#symbol-", "") as SymbolId;
    const node = props.node;
    const text =
      node?.children.length === 1 && node.children[0].type === "text"
        ? node.children[0].value
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
          <Syntax kind="bracket">
            <Link
              to="/npm/$"
              params={{ _splat: `${external.pkg}@${external.version}` }}
              hash={external.id}
              css={nonRootSymbolReference}
            >
              {text}
            </Link>
          </Syntax>
        );
      }
    }

    if (symbols[fullName]) {
      href = `#${goodIdentifiers[fullName]}`;
    }
    const external = externalSymbols[fullName];
    if (external) {
      return (
        <Link
          to="/npm/$"
          params={{ _splat: `${external.pkg}@${external.version}` }}
          hash={external.id}
          css={styles.a}
        >
          {props.children}
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
