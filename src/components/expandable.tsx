/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from "@emotion/react";
import { ReactNode } from "react";

import { ChevronDown } from "./icons/chevron-down";
import { ChevronRight } from "./icons/chevron-right";
import { Minus } from "./icons/minus";
import * as styles from "./expandable.css";

export function Expandable({
  summary,
  children,
}: {
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <details open>
      <summary css={styles.expandableSummary}>
        <ChevronDown css={styles.expandableChevronClose} />
        <ChevronRight css={styles.expandableChevronOpen} />
        {summary}
      </summary>
      <div css={styles.expandableContents}>{children}</div>
    </details>
  );
}

export function Item({ children }: { children: ReactNode }) {
  return (
    <li css={styles.item}>
      <Minus css={styles.itemIcon} />
      {children}
    </li>
  );
}
