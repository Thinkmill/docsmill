/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import { Expandable, Item } from "../../components/expandable";
import { assertNever } from "../../lib/assert";
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
import { css } from "@emotion/react";
import { codeFont, tokens } from "../../lib/theme.css";

const styles = {
  table: css(
    {
      border: "none",
      borderCollapse: "collapse",
      whiteSpace: "pre",
      margin: 8,
      code: codeFont,
    },
    codeFont
  ),
};

function SrcInner({ content }: { content: string | Token[][] }) {
  const highlightedTokens =
    typeof content === "string"
      ? content.split(/\r?\n/).map((x): Token[] => [[x, null]])
      : content;
  return (
    <div
      css={{
        margin: 16,
        backgroundColor: tokens.color.gray50,
        border: `1px solid ${tokens.color.gray200}`,
        borderRadius: 4,
        "& tr": {
          scrollMarginTop: 12 * 10,
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
      <table css={styles.table}>
        <tbody>
          {highlightedTokens.map((line, i) => (
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileStructure({ node }: { node: File | Directory }) {
  const router = useRouter();
  if (node.type === "directory") {
    return (
      <Expandable summary={node.path.match(/\/([^/]+)$/)?.[1]}>
        <ul style={{ padding: 0 }}>
          {node.files.map((x) => {
            return <FileStructure key={x.path} node={x} />;
          })}
        </ul>
      </Expandable>
    );
  }
  if (node.type === "file") {
    return (
      <Item>
        <Link
          href={`/src/${getPkgWithVersionPortionOfParms(router.query.pkg)}${
            node.path
          }`}
        >
          <a>{node.path.match(/\/([^/]+)$/)?.[1]}</a>
        </Link>
      </Item>
    );
  }
  return assertNever(node);
}

type File = {
  path: string;
  type: "file";
};

type Directory = {
  path: string;
  type: "directory";
  files: (File | Directory)[];
};

type SrcProps = {
  meta: Directory;
  content: string | Token[][];
  name: string;
};

export default function Src(props: SrcProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 4fr" }}>
      <div>
        {props.meta.files.map((x) => (
          <FileStructure key={x.path} node={x} />
        ))}
      </div>
      <SrcInner content={props.content} />
    </div>
  );
}

export function getStaticPaths(): GetStaticPathsResult {
  return { paths: [], fallback: "blocking" };
}

export async function getStaticProps({
  params,
}: GetStaticPropsContext): Promise<GetStaticPropsResult<SrcProps>> {
  const res = await redirectToPkgVersion(params?.pkg, "/src");
  if (res.kind === "handled") {
    return res.result;
  }
  await highlighterPromise;
  const filepath = res.restParams.join("/");
  const [meta, content] = await Promise.all([
    fetch(`https://unpkg.com/${res.pkg}@${res.version}/?meta`).then((x) =>
      x.json()
    ),
    res.restParams.length === 0
      ? ""
      : fetch(
          `https://unpkg.com/${res.pkg}@${res.version}/${res.restParams.join(
            "/"
          )}`
        )
          .then((x) => x.text())
          .then((x) => {
            const extension = filepath.match(/\.([^.]+)$/)?.[1];
            const lang = extensionsToLang.get(extension || "");
            if (lang !== undefined) {
              return highlight(x, lang);
            }
            return x;
          }),
  ]);
  return {
    props: { meta, content, name: res.restParams.join("/") },
    revalidate: 60 * 60,
  };
}
