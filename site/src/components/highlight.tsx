import { ReactElement } from "react";

export type Token =
  { kind: "html"; value: string } | { kind: "text"; value: string };

export function isTokens(tokens: any): tokens is Token[][] {
  return Array.isArray(tokens);
}

export function Line({ tokens }: { tokens: Token[] }): ReactElement {
  return tokens.map((token, i) => {
    if (token.kind === "html") {
      return <span key={i} dangerouslySetInnerHTML={{ __html: token.value }} />;
    }
    return <span key={i}>{token.value}</span>;
  }) as any as ReactElement;
}
