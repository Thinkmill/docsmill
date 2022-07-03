/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import { Options as ReactMarkdownOptions } from "react-markdown";
import { codeFont } from "../lib/theme.css";
import { getExternalSymbolUrl, SymbolReference } from "./symbol-references";
import { useDocsContext } from "../lib/DocsContext";
import * as styles from "./markdown.css";
import Link from "next/link";
import { nonRootSymbolReference } from "./symbol-references.css";
import { SymbolId } from "../lib/types";
import { Syntax } from "./core/syntax";
import { isTokens, Line } from "./highlight";

export const markdownComponents: ReactMarkdownOptions["components"] = {
  code: function CodeElement(props) {
    if (props.inline) {
      return <code css={codeFont}>{props.children}</code>;
    }
    const allTokens = props.node.data?.tokens;
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
          <Syntax kind="bracket">
            <Link href={getExternalSymbolUrl(external)} passHref>
              <a css={nonRootSymbolReference}>{text}</a>
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
        <Link href={getExternalSymbolUrl(external)} passHref>
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
