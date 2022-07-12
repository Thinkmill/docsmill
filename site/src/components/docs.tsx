/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from "@emotion/react";
import { markdownComponents } from "./markdown";
import { ChevronDoubleDown } from "./icons/chevron-double-down";
import { ChevronDoubleUp } from "./icons/chevron-double-up";
import { html } from "property-information";

import * as styles from "./docs.css";
import { childrenToReact } from "react-markdown/lib/ast-to-react";
import { Fragment } from "react";

const hastToReact = (children: import("hast").Content[]) =>
  childrenToReact(
    {
      listDepth: 0,
      schema: html,
      options: { components: markdownComponents },
    },
    { type: "root", children }
  );

export function Docs({ docs }: { docs: import("hast").Content[] }) {
  if (!docs) return null;

  if (docs.length >= 2) {
    return (
      <details css={styles.docs}>
        <summary css={styles.blockSummary}>
          {hastToReact([docs[0]])}
          <div css={styles.expandLinkOpen}>
            <ChevronDoubleDown css={styles.expandIcon} />
            more
          </div>
          <div css={styles.expandLinkClose}>
            <ChevronDoubleUp css={styles.expandIcon} />
            less
          </div>
        </summary>
        {hastToReact(docs.slice(1))}
      </details>
    );
  }
  return <Fragment>{hastToReact(docs)}</Fragment>;
}
