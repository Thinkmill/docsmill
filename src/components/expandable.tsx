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
      <summary className={styles.expandableSummary}>
        <ChevronDown className={styles.expandableChevronClose} />
        <ChevronRight className={styles.expandableChevronOpen} />
        {summary}
      </summary>
      <div className={styles.expandableContents}>{children}</div>
    </details>
  );
}

export function Item({ children }: { children: ReactNode }) {
  return (
    <li className={styles.item}>
      <Minus className={styles.itemIcon} />
      {children}
    </li>
  );
}
