/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from "@emotion/react";
import { css } from "@emotion/react";
import { ReactNode } from "react";

const indent = css({
  paddingLeft: 16,
});

export function Indent({ children }: { children: ReactNode }) {
  return <div css={indent}>{children}</div>;
}
