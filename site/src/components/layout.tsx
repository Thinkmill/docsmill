/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from "@emotion/react";
import { ReactNode } from "react";

import * as styles from "./layout.css";

export function Header({ packageName }: { packageName: string }) {
  return (
    <header css={styles.header}>
      <h1 css={styles.headerHeading}>{packageName}</h1>
    </header>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div css={styles.pageContainer}>{children}</div>;
}

export function NavigationContainer({ children }: { children: ReactNode }) {
  return <div css={styles.navigationContainer}>{children}</div>;
}

export function Contents({ children }: { children: ReactNode }) {
  return <div css={styles.contents}>{children}</div>;
}
