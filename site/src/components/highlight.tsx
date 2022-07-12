import { ReactElement } from "react";
import type { FontStyle } from "shiki";

export type Token = readonly [
  content: string,
  color: string | null,
  fontStyle?: FontStyle.Italic | FontStyle.Bold | FontStyle.Underline
];

export function isTokens(tokens: any): tokens is Token[][] {
  return Array.isArray(tokens);
}

export function Line({ tokens }: { tokens: Token[] }): ReactElement {
  return tokens.map((token, i) => {
    const style: import("react").CSSProperties = {
      color: token[1] ?? undefined,
    };
    if (token[2] !== undefined) {
      if (token[2] & 1) {
        style.fontStyle = "italic";
      }
      if (token[2] & 2) {
        style.fontWeight = "bold";
      }
      if (token[2] & 4) {
        style.textDecoration = "underline";
      }
    }
    return (
      <span key={i} style={style}>
        {token[0]}
      </span>
    );
  }) as any as ReactElement;
}
