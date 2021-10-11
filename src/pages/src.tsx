import { useMonaco } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import type monaco from "monaco-editor/esm/vs/editor/editor.api";
import { Expandable, Item } from "../components/expandable";
import { assertNever } from "../lib/assert";
import Link from "next/link";
import { useRouter } from "next/router";

function SrcInner({
  monaco,
  files,
  file,
}: {
  monaco: NonNullable<ReturnType<typeof useMonaco>>;
  files: Record<string, string>;
  file: string | null;
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
    const editorService = (editor as any)._codeEditorService;
    const openEditorBase = editorService.openCodeEditor.bind(editorService);
    editorService.openCodeEditor = async (
      input: {
        resource: monaco.Uri;
        options: { selection: monaco.Selection };
      },
      source: any
    ) => {
      const result = await openEditorBase(input, source);
      if (result === null) {
        let model = monaco.editor.getModel(input.resource);
        editor.setModel(model);
        editor.revealRangeInCenterIfOutsideViewport({
          startLineNumber: input.options.selection.startLineNumber,
          endLineNumber: input.options.selection.endLineNumber,
          startColumn: input.options.selection.startColumn,
          endColumn: input.options.selection.endColumn,
        });
        editor.setPosition({
          lineNumber: input.options.selection.startLineNumber,
          column: input.options.selection.startColumn,
        });
      }
      return result;
    };
    return () => {
      editor.dispose();
    };
  }, []);
  useEffect(() => {
    if (ref.current && editorRef.current) {
      for (const model of monaco.editor.getModels()) {
        model.dispose();
      }
      for (const [path, content] of Object.entries(files)) {
        monaco.editor.createModel(content, undefined, monaco.Uri.file(path));
      }
    }
  }, [monaco, files]);

  useEffect(() => {
    if (ref.current && editorRef.current && file) {
      const editor = editorRef.current;
      const model1 = monaco.editor.getModel(monaco.Uri.file(file));
      editor.setModel(model1);
    }
  }, [monaco, files, file]);

  return <div style={{ height: "100%" }} ref={ref} />;
}

function FileStructure({ node }: { node: File | Directory }) {
  const router = useRouter();
  if (node.type === "directory") {
    return (
      <Expandable summary={node.path.match(/\/([^/]+)$/)?.[1]}>
        <ul>
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
        <Link href={{ query: { ...router.query, file: node.path } }}>
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

export default function Src(props: { url: string; meta: Directory }) {
  const monaco = useMonaco();

  const file = useRouter().query.file as string | undefined;

  const [files, setFiles] = useState<{
    pkg: string;
    files: Record<string, string>;
  }>({ pkg: "@graphql-ts/schema", files: {} });
  console.log(file);
  useEffect(() => {
    if (file && !files.files[file]) {
      fetch(`${props.url}/${file}`)
        .then((x) => x.text())
        .then((content) => {
          setFiles((x) => ({ ...x, files: { ...x.files, [file]: content } }));
        });
    }
    const queue: Directory[] = [props.meta];
    for (const item of queue) {
      for (const child of item.files) {
        if (child.type === "directory") {
          queue.push(child);
        } else {
          if (!files.files[child.path]) {
            fetch(`${props.url}${child.path}`)
              .then((x) => x.text())
              .then((content) => {
                setFiles((x) => ({
                  ...x,
                  files: { ...x.files, [child.path]: content },
                }));
              });
          }
        }
      }
    }
  }, [file, props.url, files]);

  if (monaco) {
    return (
      <div style={{ display: "flex" }}>
        <div style={{ overflow: "auto", height: "100vh" }}>
          {props.meta.files.map((x) => (
            <FileStructure node={x} />
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <SrcInner monaco={monaco} files={files.files} file={file || null} />
        </div>
      </div>
    );
  }
  return "Loading...";
}

export async function getStaticProps() {
  const res = await fetch("https://unpkg.com/@graphql-ts/schema/?meta");
  const meta = await res.json();
  return { props: { meta, url: res.url.replace("/?meta", "") } };
}
