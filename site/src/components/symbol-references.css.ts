import { css as style } from "@emotion/react";
import { codeFont, syntaxColors, codeFontStyleObj } from "./core";

const baseSymbol = {
  textDecoration: "none",
  ":hover": { textDecoration: "underline" },
};

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
