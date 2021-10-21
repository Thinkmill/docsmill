import { useMonaco } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import type monaco from "monaco-editor/esm/vs/editor/editor.api";
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

function SrcInner({
  monaco,
  file,
}: {
  monaco: NonNullable<ReturnType<typeof useMonaco>>;
  file: { name: string; content: string } | null;
}) {
  const ref = useRef<null | HTMLDivElement>(null);
  const editorRef = useRef<null | monaco.editor.ICodeEditor>();
  useEffect(() => {
    if (!ref.current) return;
    const editor = monaco.editor.create(ref.current, {
      model: null,
      domReadOnly: true,
      readOnly: true,
      automaticLayout: true,
    });
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSuggestionDiagnostics: true,
    });
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSuggestionDiagnostics: true,
    });
    editorRef.current = editor;
    // const editorService = (editor as any)._codeEditorService;
    // const openEditorBase = editorService.openCodeEditor.bind(editorService);
    // editorService.openCodeEditor = async (
    //   input: {
    //     resource: monaco.Uri;
    //     options: { selection: monaco.Selection };
    //   },
    //   source: any
    // ) => {
    //   const result = await openEditorBase(input, source);
    //   if (result === null) {
    //     let model = monaco.editor.getModel(input.resource);
    //     editor.setModel(model);
    //     editor.revealRangeInCenterIfOutsideViewport({
    //       startLineNumber: input.options.selection.startLineNumber,
    //       endLineNumber: input.options.selection.endLineNumber,
    //       startColumn: input.options.selection.startColumn,
    //       endColumn: input.options.selection.endColumn,
    //     });
    //     editor.setPosition({
    //       lineNumber: input.options.selection.startLineNumber,
    //       column: input.options.selection.startColumn,
    //     });
    //   }
    //   return result;
    // };
    return () => {
      editor.dispose();
    };
  }, []);
  useEffect(() => {
    if (ref.current && editorRef.current) {
      for (const model of monaco.editor.getModels()) {
        model.dispose();
      }
      if (file) {
        const model = monaco.editor.createModel(
          file.content,
          undefined,
          monaco.Uri.file(file.name)
        );
        editorRef.current.setModel(model);
        if (window.location.hash.startsWith("#L")) {
          const lineNumber = parseInt(window.location.hash.replace("#L", ""));
          if (lineNumber) {
            editorRef.current.revealLineNearTop(lineNumber);
            editorRef.current.setPosition({ lineNumber, column: 1 });
            editorRef.current.focus();
          }
        }
      }
    }
  }, [monaco, file]);

  return <div style={{ height: "100%" }} ref={ref} />;
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
  content: string;
  name: string;
};

export default function Src(props: SrcProps) {
  const monaco = useMonaco();
  if (monaco) {
    return (
      <div style={{ display: "flex" }}>
        <div style={{ overflow: "auto", height: "100vh" }}>
          {props.meta.files.map((x) => (
            <FileStructure key={x.path} node={x} />
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <SrcInner
            monaco={monaco}
            file={{ content: props.content, name: props.name }}
          />
        </div>
      </div>
    );
  }
  return "Loading...";
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
        ).then((x) => x.text()),
  ]);
  return {
    props: { meta, content, name: res.restParams.join("/") },
    revalidate: 60 * 60,
  };
}
