/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from "@emotion/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { redirectToPkgVersion } from "../../npm/version-redirect";
import {
  GetStaticPathsResult,
  GetStaticPropsContext,
  GetStaticPropsResult,
} from "next";
import { getPkgWithVersionPortionOfParms } from "../../npm/params";
import {
  extensionsToLang,
  highlight,
  highlighterPromise,
} from "../../extract/highlight";
import { Line, Token } from "../../components/highlight";
import { tokens } from "../../lib/theme.css";
import { ReactNode } from "react";
import { PackageHeader } from "../../components/package-header";
import { getPackageMetadata } from "../../npm/fetch-package-metadata";
import { codeFont } from "@docsmill/print-core";

function SrcInner({ content }: { content: string | Token[][] }) {
  const highlightedTokens =
    typeof content === "string"
      ? content
          .split(/\r?\n/)
          .map((x): Token[] => (x === "" ? [] : [[x, null]]))
      : [...content];
  let hasTrailingNewline =
    highlightedTokens[highlightedTokens.length - 1]?.length === 0;
  if (hasTrailingNewline) {
    highlightedTokens.pop();
  }
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
          ":target": {
            backgroundColor: "#ffff54ba",
          },
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
        "& td:nth-of-type(2)": {
          padding: "0 0 0 8px",
        },
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
          {highlightedTokens.map((line, i) => {
            return (
              <tr id={`L${i + 1}`} key={i}>
                <td>
                  <a href={`#L${i + 1}`}></a>
                </td>
                <td>
                  <code>
                    <Line tokens={line} />
                  </code>
                </td>
              </tr>
            );
          })}
          {!hasTrailingNewline && (
            <tr>
              <td></td>
              <td css={{ userSelect: "none" }}>No newline at end of file</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FileStructureList(props: { children: ReactNode }) {
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
      {props.children}
    </ul>
  );
}

function FileStructure({ entry, path }: { entry: Entry; path: string[] }) {
  const router = useRouter();
  if (typeof entry === "string") {
    return (
      <Link
        href={`/src/${getPkgWithVersionPortionOfParms(router.query.pkg)}/${path
          .concat(entry)
          .join("/")}`}
        title={entry}
      >
        {entry}
      </Link>
    );
  }
  const innerPath = path.concat(entry[0]);
  return (
    <details css={{ marginLeft: 4 }}>
      <summary title={entry[0]}>{entry[0]}</summary>
      <FileStructureList>
        {entry[1].map((entry) => {
          const name = typeof entry === "string" ? entry : entry[0];
          return (
            <li key={name}>
              <FileStructure entry={entry} path={innerPath} />
            </li>
          );
        })}
      </FileStructureList>
    </details>
  );
}

type File = string;

type Directory = [string, Entry[]];

type Entry = File | Directory;

type SrcProps = {
  versions?: string[];
  entries?: Entry[];
  content?: null | string | Token[][];
};

export default function Src({
  entries = [],
  content,
  versions = [],
}: SrcProps) {
  const router = useRouter();
  const pkgInfo = router.query.pkg
    ? getPkgAndVersionFromQuery(router.query.pkg)
    : { name: "Loading...", version: "" };
  const filename = router.query.pkg
    ? getFilenameFromQuery(router.query.pkg)
    : "";
  return (
    <div>
      <PackageHeader
        packageName={pkgInfo.name}
        version={pkgInfo.version}
        versions={versions}
      />
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
            {entries.map((entry) => (
              <li key={typeof entry === "string" ? entry : entry[0]}>
                <FileStructure entry={entry} path={[]} />
              </li>
            ))}
          </FileStructureList>
        </div>
        {content === undefined ? null : content === null ? (
          "No file could be found"
        ) : (
          <SrcInner key={filename} content={content} />
        )}
      </div>
    </div>
  );
}

function getPkgAndVersionFromQuery(params: string | string[] | undefined) {
  if (!Array.isArray(params)) {
    throw new Error("expected params to be array");
  }
  if (params[0][0] === "@") {
    const [name, version] = params[1].split("@");
    return { name: `${params[0]}/${name}`, version };
  }
  const [name, version] = params[0].split("@");
  return { name, version };
}

function getFilenameFromQuery(params: string | string[] | undefined) {
  if (!Array.isArray(params)) {
    throw new Error("expected params to be array");
  }
  let start = 1;
  if (params[0][0] === "@") {
    start = 2;
  }
  return params.slice(start).join("/");
}

export function getStaticPaths(): GetStaticPathsResult {
  return { paths: [], fallback: true };
}

type InputFile = {
  name: string;
  type: "file";
};

type InputDirectory = {
  name: string;
  type: "directory";
  files: (InputFile | InputDirectory)[];
};

function transformDirectory(directory: InputDirectory): Entry[] {
  return directory.files
    .sort((a, b) => {
      if (a.type === "directory" && b.type === "file") {
        return -1;
      }
      if (a.type === "file" && b.type === "directory") {
        return 1;
      }
      return a.name.localeCompare(b.name);
    })
    .map((element): Entry => {
      if (element.type === "directory") {
        return [element.name, transformDirectory(element)];
      }
      return element.name;
    });
}

export async function getStaticProps({
  params,
}: GetStaticPropsContext): Promise<GetStaticPropsResult<SrcProps>> {
  const res = await redirectToPkgVersion(params?.pkg, "/src");
  if (res.kind === "handled") {
    return res.result;
  }
  const filepath = res.restParams.join("/");
  const [pkgMetadata, entries, content] = await Promise.all([
    getPackageMetadata(res.pkg),
    fetch(
      `https://data.jsdelivr.com/v1/package/npm/${res.pkg}@${res.version}`,
      { headers: { "User-Agent": "https://github.com/Thinkmill/docsmill" } }
    )
      .then((x) => x.json())
      .then((data) => transformDirectory(data)),
    res.restParams.length === 0
      ? null
      : fetch(
          `https://cdn.jsdelivr.net/npm/${res.pkg}@${
            res.version
          }/${res.restParams.join("/")}`
        ).then(async (res) => {
          if (res.status === 404) return null;
          const text = await res.text();
          const extension = filepath.match(/\.([^.]+)$/)?.[1];
          const lang = extensionsToLang.get(extension || "");
          if (lang !== undefined) {
            await highlighterPromise;
            return highlight(text, lang);
          }
          return text;
        }),
  ]);
  if (pkgMetadata === undefined) {
    return { notFound: true };
  }
  return {
    props: { entries, content, versions: pkgMetadata?.versions },
    revalidate: 60 * 60,
  };
}
