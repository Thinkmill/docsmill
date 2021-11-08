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

export function SymbolName({
  fullName,
  name,
}: {
  name: string;
  fullName: SymbolId;
}) {
  const { goodIdentifiers } = useDocsContext();
  return (
    <a
      id={goodIdentifiers[fullName]}
      css={styles.symbolName}
      href={`#${goodIdentifiers[fullName]}`}
    >
      {name}
    </a>
  );
}

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

export function SymbolReference({
  fullName,
  name,
}: {
  name: string;
  fullName: SymbolId;
}) {
  const {
    symbols,
    canonicalExportLocations,
    goodIdentifiers,
    externalSymbols,
  } = useDocsContext();
  const namesInScope = useContext(NamesInScopeContext);
  const externalReference = symbols[fullName]
    ? undefined
    : externalReferences.get(name);
  if (externalSymbols[fullName]) {
    const external = externalSymbols[fullName];
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
  if (fullName === undefined || !symbols[fullName]) {
    return <span css={styles.unknownExternalReference}>{name}</span>;
  }

  const decls = symbols[fullName];
  const firstDocsBit = splitDocs(
    decls.find((x) => !!x.docs.length)?.docs || ""
  ).first;

  const isModuleSymbol = decls.some((x) => x.kind === "module");

  const props: AnchorHTMLAttributes<HTMLAnchorElement> & {
    css: import("@emotion/react").SerializedStyles;
  } = {
    css: isModuleSymbol
      ? styles.rootSymbolReference
      : styles.nonRootSymbolReference,

    href: `#${goodIdentifiers[fullName]}`,
    children: isModuleSymbol ? JSON.stringify(name) : name,
  };
  if (symbols[fullName][0].kind === "unknown") {
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
      {({ triggerProps }) => <a {...triggerProps} {...props} />}
    </Tooltip>
  ) : (
    <a {...props} />
  );

  if (
    namesInScope.has(name) &&
    namesInScope.get(name) !== fullName &&
    canonicalExportLocations[fullName] !== undefined
  ) {
    const canonicalExportLocation = canonicalExportLocations[fullName];
    return (
      <span css={codeFont}>
        <Syntax kind="keyword">import</Syntax>
        <Syntax kind="bracket">(</Syntax>
        <SymbolReference
          fullName={canonicalExportLocation.parent}
          name={symbols[canonicalExportLocation.parent][0].name}
        />
        <Syntax kind="bracket">)</Syntax>.{inner}
      </span>
    );
  }

  return inner;
}
