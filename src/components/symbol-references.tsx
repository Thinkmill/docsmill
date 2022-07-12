/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from "@emotion/react";
import {
  createContext,
  useContext,
  ReactNode,
  useMemo,
  AnchorHTMLAttributes,
} from "react";
import { useDocsContext } from "../lib/DocsContext";
import { Syntax } from "./core/syntax";
import * as styles from "./symbol-references.css";
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
      <Syntax kind="bracket">
        <Syntax kind="keyword">import</Syntax>(
        <Link
          href={getExternalPackageUrl(external.pkg, external.version)}
          css={styles.rootSymbolReference}
        >
          {JSON.stringify(pkgDisplayName)}
        </Link>
        ).
        <Link
          href={getExternalSymbolUrl(external)}
          css={styles.nonRootSymbolReference}
        >
          {name}
        </Link>
      </Syntax>
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

  let inner = <a {...props} />;

  if (
    namesInScope.has(name) &&
    namesInScope.get(name) !== id &&
    canonicalExportLocations[id] !== undefined
  ) {
    const canonicalExportLocation = canonicalExportLocations[id];
    return (
      <Syntax kind="bracket">
        <Syntax kind="keyword">import</Syntax>
        (
        <SymbolReference
          id={canonicalExportLocation}
          name={symbols[canonicalExportLocation][0].name}
        />
        ).{inner}
      </Syntax>
    );
  }

  return inner;
}
