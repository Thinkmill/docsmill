/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from "@emotion/react";

import { css } from "@emotion/react";
import { ReactNode } from "react";

function mapObj<Key extends string, Input, Output>(
  input: Record<Key, Input>,
  map: (input: Input) => Output
): Record<Key, Output> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, map(value as any)])
  ) as any;
}

export const syntaxColors = {
  parameter: "#111111",
  symbol: "#4876d6",
  keyword: "#994cc3",
  bracket: "#403f53",
  colon: "#0c969b",
  comma: "#5f7e97",
  string: "#c96765",
  intrinsic: "#2c8093",
  error: "red",
};

export const codeFontStyleObj = {
  fontFamily: `
    'Fira Code',
    'Source Code Pro',
    'fontFamily.mono',
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    'Liberation Mono',
    'Courier New',
    monospace
  `,
  fontVariantLigatures: "none",
};

export const codeFont = css(codeFontStyleObj);

export const syntaxKinds = mapObj(syntaxColors, (color) =>
  css({ color, ...codeFontStyleObj })
);

export function Syntax({
  children,
  kind,
}: {
  children: ReactNode;
  kind: keyof typeof syntaxKinds;
}) {
  return <span css={syntaxKinds[kind]}>{children}</span>;
}
