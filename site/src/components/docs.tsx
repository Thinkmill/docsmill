/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from "@emotion/react";
import { markdownComponents } from "./markdown";
import { ChevronDoubleDown } from "./icons/chevron-double-down";
import { ChevronDoubleUp } from "./icons/chevron-double-up";
import * as styles from "./docs.css";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment, ReactNode } from "react";
import { jsx as runtimeJsx, jsxs as runtimeJsxs } from "react/jsx-runtime";

const hastToReact = (children: import("hast").Content[]) =>
  toJsxRuntime(
    { type: "root", children },
    {
      Fragment,
      components: markdownComponents,
      jsx: runtimeJsx,
      jsxs: runtimeJsxs,
      passKeys: true,
      passNode: true,
    },
  ) as ReactNode;

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
