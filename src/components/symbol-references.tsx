/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import {
  createContext,
  useContext,
  ReactNode,
  useMemo,
  AnchorHTMLAttributes,
} from "react";
import { useDocsContext } from "../lib/DocsContext";
import { codeFont } from "../lib/theme.css";
import { splitDocs } from "../lib/utils";
import { Markdown } from "./markdown";
import { Syntax } from "./syntax";
import * as styles from "./symbol-references.css";
import { Tooltip } from "./tooltip";
import Link from "next/link";
import { SymbolId } from "../lib/types";

const NamesInScopeContext = createContext<Map<string, SymbolId>>(new Map());

const externalReferences = new Map(
  Object.entries({
    Iterable:
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_iterable_protocol",
    Promise:
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise",
  })
);

export function AddNameToScope({
  name,
  fullName,
  children,
}: {
  name: string;
  fullName: SymbolId;
  children: ReactNode;
}) {
  const namesInScope = useContext(NamesInScopeContext);
  const newNamesInScope = useMemo(
    () => new Map([...namesInScope, [name, fullName]]),
    [namesInScope, name]
  );
  return (
    <NamesInScopeContext.Provider value={newNamesInScope}>
      {children}
    </NamesInScopeContext.Provider>
  );
}

function getExternalPkgDisplayName(pkg: string) {
  if (pkg.startsWith("@types/")) {
    let withoutTypes = pkg.replace("@types/", "");
    if (withoutTypes.includes("__")) {
      return `@${withoutTypes.replace("__", "/")}`;
    }
    return withoutTypes;
  }
  return pkg;
}

export function getExternalPackageUrl(pkg: string, version: string) {
  return `/npm/${pkg}@${version}`;
}

export function getExternalSymbolUrl(external: {
  pkg: string;
  version: string;
  id: string;
}) {
  return `${getExternalPackageUrl(external.pkg, external.version)}#${
    external.id
  }`;
}

export function SymbolReference({ id, name }: { name: string; id: SymbolId }) {
  const {
    symbols,
    canonicalExportLocations,
    goodIdentifiers,
    externalSymbols,
    rootSymbols,
  } = useDocsContext();
  const namesInScope = useContext(NamesInScopeContext);
  const externalReference = symbols[id]
    ? undefined
    : externalReferences.get(name);
  if (externalSymbols[id]) {
    const external = externalSymbols[id];
    const pkgDisplayName = getExternalPkgDisplayName(external.pkg);
    return (
      <span css={codeFont}>
        <Syntax kind="keyword">import</Syntax>
        <Syntax kind="bracket">(</Syntax>
        <Link href={getExternalPackageUrl(external.pkg, external.version)}>
          <a css={styles.rootSymbolReference}>
            {JSON.stringify(pkgDisplayName)}
          </a>
        </Link>
        <Syntax kind="bracket">)</Syntax>.
        <Link href={getExternalSymbolUrl(external)}>
          <a css={styles.nonRootSymbolReference}>{name}</a>
        </Link>
      </span>
    );
  }
  if (externalReference !== undefined) {
    return (
      <a css={styles.nonRootSymbolReference} href={externalReference}>
        {name}
      </a>
    );
  }
  if (id === undefined || !symbols[id]) {
    return <span css={styles.unknownExternalReference}>{name}</span>;
  }

  const decls = symbols[id];
  const firstDocsBit = splitDocs(
    decls.find((x) => !!x.docs.length)?.docs || ""
  ).first;

  const isRootModuleSymbol =
    rootSymbols.has(id) && decls.some((x) => x.kind === "module");

  const props: AnchorHTMLAttributes<HTMLAnchorElement> & {
    css: import("@emotion/react").SerializedStyles;
  } = {
    css: isRootModuleSymbol
      ? styles.rootSymbolReference
      : styles.nonRootSymbolReference,

    href: `#${goodIdentifiers[id]}`,
    children: isRootModuleSymbol ? JSON.stringify(name) : name,
  };
  if (symbols[id][0].kind === "unknown") {
    props.style = { color: "red" };
  }

  let inner = firstDocsBit ? (
    <Tooltip
      tooltip={
        <span css={styles.tooltipMarkdownContent}>
          <Markdown content={firstDocsBit} />
        </span>
      }
    >
      {function TooltipTrigger({ triggerProps }) {
        return <a {...triggerProps} {...props} />;
      }}
    </Tooltip>
  ) : (
    <a {...props} />
  );

  if (
    namesInScope.has(name) &&
    namesInScope.get(name) !== id &&
    canonicalExportLocations[id] !== undefined
  ) {
    const canonicalExportLocation = canonicalExportLocations[id];
    return (
      <span css={codeFont}>
        <Syntax kind="keyword">import</Syntax>
        <Syntax kind="bracket">(</Syntax>
        <SymbolReference
          id={canonicalExportLocation.parent}
          name={symbols[canonicalExportLocation.parent][0].name}
        />
        <Syntax kind="bracket">)</Syntax>.{inner}
      </span>
    );
  }

  return inner;
}
