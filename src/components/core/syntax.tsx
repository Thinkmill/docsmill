/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */

import { css } from "@emotion/react";
import { ReactNode } from "react";
import { codeFontStyleObj, syntaxColors } from "../../lib/theme.css";

export const syntaxKinds = {
  parameter: css({ color: syntaxColors.parameter, ...codeFontStyleObj }),
  keyword: css({ color: syntaxColors.keyword, ...codeFontStyleObj }),
  bracket: css({ color: syntaxColors.bracket, ...codeFontStyleObj }),
  colon: css({ color: syntaxColors.colon, ...codeFontStyleObj }),
  comma: css({ color: syntaxColors.comma, ...codeFontStyleObj }),
  string: css({ color: syntaxColors.string, ...codeFontStyleObj }),
};

export function Syntax({
  children,
  kind,
}: {
  children: ReactNode;
  kind: keyof typeof syntaxKinds;
}) {
  return <span css={syntaxKinds[kind]}>{children}</span>;
}
