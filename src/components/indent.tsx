/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import { ReactNode } from "react";
import * as styles from "./indent.css";

export function Indent({ children }: { children: ReactNode }) {
  return <div css={styles.indent}>{children}</div>;
}
