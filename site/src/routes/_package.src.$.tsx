/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from "@emotion/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ReactNode } from "react";
import { Line, Token } from "../components/highlight";
import { codeFont } from "../components/core";
import { tokens } from "../lib/theme.css";
import { loadSourceInBrowser } from "../workers/client";
import type { SourceEntry } from "../workers/data";

export const Route = createFileRoute("/_package/src/$")({
  ssr: false,
  loader: ({ params }) => loadSourceInBrowser(params._splat ?? ""),
  pendingComponent: () => (
    <main style={{ margin: 16 }}>Loading package source…</main>
  ),
  component: SourceRoute,
});

function SrcInner({ content }: { content: string | Token[][] }) {
  const highlightedTokens =
    typeof content === "string"
      ? content
          .split(/\r?\n/)
          .map((line): Token[] =>
            line === "" ? [] : [{ kind: "text", value: line }],
          )
      : [...content];
  const hasTrailingNewline =
    highlightedTokens[highlightedTokens.length - 1]?.length === 0;
  if (hasTrailingNewline) highlightedTokens.pop();

  return (
    <div
      css={{
        flexGrow: 1,
        backgroundColor: tokens.color.gray50,
        border: `1px solid ${tokens.color.gray200}`,
        borderRadius: 4,
        "& tr": {
          scrollMarginTop: 12 * 10,
          scrollMarginLeft: 8,
          counterIncrement: "line",
          ":target": { backgroundColor: "#ffff54ba" },
        },
        "& a": {
          "::before": {
            display: "block",
            content: "counter(line)",
            top: 0,
            left: 0,
            textAlign: "right",
            minWidth: 30,
          },
          color: tokens.color.gray600,
          textDecoration: "none",
        },
        "& td:nth-of-type(2)": { padding: "0 0 0 8px" },
        overflowX: "scroll",
        height: "max-content",
      }}
    >
      <table
        css={[
          {
            border: "none",
            borderCollapse: "collapse",
            whiteSpace: "pre",
            margin: 8,
            code: codeFont,
          },
          codeFont,
        ]}
      >
        <tbody>
          {highlightedTokens.map((line, index) => (
            <tr id={`L${index + 1}`} key={index}>
              <td>
                <a href={`#L${index + 1}`} />
              </td>
              <td>
                <code>
                  <Line tokens={line} />
                </code>
              </td>
            </tr>
          ))}
          {!hasTrailingNewline && (
            <tr>
              <td />
              <td css={{ userSelect: "none" }}>No newline at end of file</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FileStructureList({ children }: { children: ReactNode }) {
  return (
    <ul
      css={{
        padding: 0,
        margin: 0,
        borderLeft: "solid 1px lightgray",
        paddingLeft: 4,
        listStyle: "none",
      }}
    >
      {children}
    </ul>
  );
}

function FileStructure({
  entry,
  path,
  packageRef,
}: {
  entry: SourceEntry;
  path: string[];
  packageRef: string;
}) {
  if (typeof entry === "string") {
    const splat = `${packageRef}/${path.concat(entry).join("/")}`;
    return (
      <Link to="/src/$" params={{ _splat: splat }} title={entry}>
        {entry}
      </Link>
    );
  }
  const innerPath = path.concat(entry[0]);
  return (
    <details css={{ marginLeft: 4 }}>
      <summary title={entry[0]}>{entry[0]}</summary>
      <FileStructureList>
        {entry[1].map((child) => {
          const name = typeof child === "string" ? child : child[0];
          return (
            <li key={name}>
              <FileStructure
                entry={child}
                path={innerPath}
                packageRef={packageRef}
              />
            </li>
          );
        })}
      </FileStructureList>
    </details>
  );
}

function SourceRoute() {
  const data = Route.useLoaderData();
  return (
    <div>
      <div style={{ display: "flex", margin: 8, position: "relative" }}>
        <div
          css={{
            minWidth: 250,
            width: 250,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            position: "sticky",
            top: 0,
          }}
        >
          <FileStructureList>
            {data.entries.map((entry) => (
              <li key={typeof entry === "string" ? entry : entry[0]}>
                <FileStructure
                  entry={entry}
                  path={[]}
                  packageRef={data.packageRef}
                />
              </li>
            ))}
          </FileStructureList>
        </div>
        {data.content === null ? (
          "No file could be found"
        ) : (
          <SrcInner key={data.filename} content={data.content} />
        )}
      </div>
    </div>
  );
}
