import { createVar, fallbackVar, style } from "@vanilla-extract/css";
import {
  codeFont,
  codeFontStyleObj,
  syntaxColors,
  tokens,
} from "../lib/theme.css";

export const moduleHeading = style({
  fontSize: "2rem",
  marginBottom: 16,
  ...codeFontStyleObj,
});

const symbolDepthVar = createVar("symbol-depth");
const intermediateSymbolDepthVar = createVar("intermediate-symbol-depth");

export const rootSymbolContainer = style({
  borderBottom: `1px solid ${tokens.color.gray200}`,
  paddingBottom: 24,
  marginBottom: 16,
  vars: {
    [intermediateSymbolDepthVar]: symbolDepthVar,
  },
});

export const innerExportsHeading = style([
  codeFont,
  {
    fontSize: "1.2rem",
    fontWeight: 500,
    position: "sticky",
    top: `calc(${fallbackVar(symbolDepthVar, "0")} * 54px)`,
    padding: "6px 0px",
    marginLeft: "2px",
    borderBottom: "1px solid transparent",
    transitionProperty: "padding",
    transitionDuration: "0.3s",
    transitionTimingFunction: "cubic-bezier(0, 0, 0.2, 1)",
  },
]);

export const innerExportsHeadingSticky = style({
  background: "rgba(255,255,255,0.8)",
  borderBottom: "1px solid rgba(0,0,0,0.10)",
  backdropFilter: "blur( 4px )",
  padding: "6px 12px",
});

export const innerExportsContainer = style({
  borderLeft: `2px solid ${tokens.color.blueGray300}`,
  marginTop: 16,
  marginBottom: 16,
  paddingLeft: 16,
  vars: {
    [symbolDepthVar]: `calc(${fallbackVar(
      intermediateSymbolDepthVar,
      "0"
    )} + 1)`,
  },
});

export const referencesContainer = style({
  borderBottom: `1px solid ${tokens.color.gray200}`,
  paddingBottom: 24,
  marginBottom: 16,
});

export const referenceItem = style({
  listStylePosition: "inside",
  listStyleType: "disc",
});

export const targetBackground = style({
  ":target": { backgroundColor: "#ffff54ba" },
});

export const moduleSpecifierLink = style({
  color: syntaxColors.string,
  ":hover": { textDecoration: "underline" },
  ":target": { backgroundColor: "#ffff54ba" },
});

export const reexportTarget = style([targetBackground, codeFont]);

export const symbolHeading = style({
  fontSize: "1.6rem",
  marginBottom: 16,
  ...codeFontStyleObj,
  scrollMarginTop: `calc(${fallbackVar(symbolDepthVar, "0")} * 54px + 8px)`,
  ":target": {
    backgroundColor: "#ffff54ba",
  },
});
