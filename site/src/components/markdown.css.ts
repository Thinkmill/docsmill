import { css as style } from "@emotion/react";
import { codeFont } from "./core";
import { tokens } from "../lib/theme.css";

export const a = style({
  color: tokens.color.blue600,
  textDecoration: "none",
  ":hover": {
    color: tokens.color.blue800,
    textDecoration: "underline",
  },
});

export const codeblock = style([
  codeFont,
  {
    fontWeight: 400,
    padding: "12px",
    fontSize: "0.9rem",
    margin: "16px 16px 16px 0",
    backgroundColor: tokens.color.gray50,
    border: `1px solid ${tokens.color.gray200}`,
    borderRadius: 6,
  },
]);

export const codeblockInner = style({ backgroundColor: "transparent" });

export const highlightedCode = style(codeblock, codeblockInner, {
  pre: {
    margin: 0,
    fontFamily: "inherit",
  },
});
