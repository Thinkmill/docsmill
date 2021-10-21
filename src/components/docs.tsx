/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import { splitDocs } from "../lib/utils";
import { Markdown } from "./markdown";
import { ChevronDoubleDown } from "./icons/chevron-double-down";
import { ChevronDoubleUp } from "./icons/chevron-double-up";

import * as styles from "./docs.css";

export function Docs({ content }: { content: string | undefined }) {
  if (!content) return null;

  const { first, rest } = splitDocs(content);

  if (!rest) {
    return (
      <div css={styles.docs}>
        <Markdown content={first} />
      </div>
    );
  }
  return (
    <details css={styles.docs}>
      <summary css={styles.blockSummary}>
        <Markdown content={first} />
        <div css={styles.expandLinkOpen}>
          <ChevronDoubleDown css={styles.expandIcon} />
          more
        </div>
        <div css={styles.expandLinkClose}>
          <ChevronDoubleUp css={styles.expandIcon} />
          less
        </div>
      </summary>
      <Markdown content={rest} />
    </details>
  );
}
