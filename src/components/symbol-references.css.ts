import { globalStyle, style } from "@vanilla-extract/css";
import { codeFont, syntaxColors, codeFontStyleObj } from "../lib/theme.css";
import { targetBackground } from "./symbol.css";

const baseSymbol = {
  textDecoration: "none",
  ":hover": { textDecoration: "underline" },
};

export const symbolName = style([
  codeFont,
  targetBackground,
  {
    color: syntaxColors.symbol,
    ...baseSymbol,
  },
]);

export const unknownExternalReference = style([
  codeFont,
  style({
    color: "#f92672",
  }),
]);

export const rootSymbolReference = style({
  color: syntaxColors.string,
  ...codeFontStyleObj,
  ...baseSymbol,
});

export const nonRootSymbolReference = style({
  color: syntaxColors.symbol,
  ...codeFontStyleObj,
  ...baseSymbol,
});

export const tooltipMarkdownContent = style({});

globalStyle(`${tooltipMarkdownContent} :last-child`, { marginBottom: 0 });

globalStyle(`${tooltipMarkdownContent} *`, {
  color: "inherit !important",
});
