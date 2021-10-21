/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import { ReactNode } from "react";

import * as styles from "./layout.css";
import { PackageSearch } from "./package-search";

export function Header({ packageName }: { packageName: string }) {
  return (
    <header css={styles.header}>
      <h1 css={styles.headerHeading}>{packageName} API Documentation</h1>
      <div css={styles.headerSearch}>
        <PackageSearch />
      </div>
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
