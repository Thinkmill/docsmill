import { createVar, fallbackVar, style } from "@vanilla-extract/css";
import {
  codeFont,
  codeFontStyleObj,
  syntaxColors,
  tokens,
} from "../lib/theme.css";

export const moduleHeading = style({
  fontSize: "2rem",
  fontWeight: "normal",
  marginBottom: 16,
  marginTop: 0,
  ...codeFontStyleObj,
});

const HEADER_HEIGHT = 42;

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

export const declarationContainer = style({
  display: "flex",
  justifyContent: "space-between",
});

export const innerExportsCommon = style({
  fontSize: "1.2rem",
  fontWeight: 500,
  padding: "6px 4px",
});

export const innerExportsHeading = style([
  codeFont,
  innerExportsCommon,
  {
    position: "sticky",
    top: `calc(${fallbackVar(symbolDepthVar, "0")} * ${HEADER_HEIGHT}px)`,
    background: "rgba(255,255,255,0.8)",
    borderBottom: `2px solid ${tokens.color.blueGray300}`,
    backdropFilter: "blur( 4px )",
    marginLeft: 2,
  },
]);

export const innerExportsContainer = style({
  borderLeft: `2px solid ${tokens.color.blueGray300}`,
  paddingTop: 16,
  marginTop: -2,
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

export const referenceList = style({
  padding: 0,
});

export const targetBackground = style({
  ":target": { backgroundColor: "#ffff54ba" },
});

export const moduleSpecifierLink = style({
  color: syntaxColors.string,
  textDecoration: "none",
  ":hover": { textDecoration: "underline" },
  ":target": { backgroundColor: "#ffff54ba" },
});

export const reexportTarget = style([targetBackground, codeFont]);

export const symbolHeading = style({
  fontSize: "1.6rem",
  fontWeight: "normal",
  marginBottom: 16,
  marginTop: 0,
  ...codeFontStyleObj,
  scrollMarginTop: `calc(${fallbackVar(
    symbolDepthVar,
    "0"
  )} * ${HEADER_HEIGHT}px + 8px)`,
  ":target": {
    backgroundColor: "#ffff54ba",
  },
});
