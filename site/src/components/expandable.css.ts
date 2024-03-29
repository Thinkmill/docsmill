import { css as style } from "@emotion/react";
import { tokens } from "../lib/theme.css";

export const expandable = style({
  paddingLeft: 6,
});

export const expandableContents = style({
  borderLeft: `2px solid ${tokens.color.gray300}`,
  marginLeft: 8,
  marginBottom: 8,
  paddingLeft: 12,
});

export const expandableSummary = style({
  display: "block",
  fontWeight: "bold",
  marginBottom: 8,
  "&::-webkit-details-marker": {
    display: "none",
  },
});

const expandableChevron = style({
  cursor: "pointer",
  marginTop: 3,
  marginRight: 5,
  width: 20,
  height: 20,
  color: tokens.color.gray400,
  verticalAlign: "middle",
});

export const expandableChevronOpen = style([
  expandableChevron,
  {
    display: "inline",
    "details[open] > summary > &": {
      display: "none",
    },
  },
]);

export const expandableChevronClose = style([
  expandableChevron,
  {
    display: "none",
    "details[open] > summary > &": {
      display: "inline",
    },
  },
]);

export const itemIcon = style({
  marginTop: 3,
  marginRight: 5,
  width: 20,
  height: 20,
  color: tokens.color.gray300,
});

export const item = style({
  paddingRight: 16,
  display: "flex",
  whiteSpace: "nowrap",
  "& *": {
    textOverflow: "ellipsis",
    overflow: "hidden",
  },
});
