import { css as style } from "@emotion/react";
import { tokens } from "../lib/theme.css";

export const docs = style({
  borderLeft: `2px solid ${tokens.color.emerald200}`,
  paddingLeft: 16,
  marginTop: 16,
  marginBottom: 16,
});

export const blockSummary = style({
  display: "block",
  "&::-webkit-details-marker": {
    display: "none",
  },
});

const expandLink = style({
  display: "flex",
  cursor: "pointer",
  margin: "8px 0 16px",
  ":hover": {
    textDecoration: "underline",
  },
});

export const expandLinkOpen = style([
  expandLink,
  {
    color: tokens.color.emerald500,
    "details[open] > summary > &": {
      display: "none",
    },
  },
]);

export const expandLinkClose = style([
  expandLink,
  {
    color: tokens.color.emerald700,
    "*:not(details[open]) > summary > &": {
      display: "none",
    },
  },
]);

export const expandIcon = style({
  marginTop: 5,
  marginRight: 5,
  width: 16,
  height: 16,
});
