/** @jsxRuntime automatic */
/** @jsxImportSource @emotion/react */
import { useRouter } from "next/router";
import { getExternalPackageUrl } from "./symbol-references";

import * as layoutStyles from "./layout.css";
import { useState } from "react";
import PackageSearch from "./package-search";

export function PackageHeader(props: {
  packageName: string;
  versions: string[];
  version: string;
}) {
  return (
    <header css={layoutStyles.header}>
      <div css={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 css={layoutStyles.headerHeading}>{props.packageName}</h1>
        <VersionSelect
          packageName={props.packageName}
          version={props.version}
          versions={props.versions}
        />
      </div>
      <div css={layoutStyles.headerSearch}>
        <PackageSearch />
      </div>
    </header>
  );
}

function VersionSelect(props: {
  packageName: string;
  version: string;
  versions: string[];
}) {
  const router = useRouter();
  const [versionState, setVersionState] = useState({
    fromCurrentProps: props.version,
    current: props.version,
  });
  if (props.version !== versionState.fromCurrentProps) {
    setVersionState({
      current: props.version,
      fromCurrentProps: props.version,
    });
  }
  return (
    <span>
      <select
        css={{
          width: 250,
        }}
        onChange={(event) => {
          const newVersion = event.target.value;
          router.push({
            pathname: getExternalPackageUrl(props.packageName, newVersion),
            hash: window.location.hash,
          });
          setVersionState((x) => ({ ...x, current: newVersion }));
        }}
        value={versionState.current}
        disabled={versionState.current !== versionState.fromCurrentProps}
      >
        {props.versions.map((version) => (
          <option key={version}>{version}</option>
        ))}
      </select>
      {versionState.current !== versionState.fromCurrentProps && (
        <span aria-label="Loading new version">⏳</span>
      )}
    </span>
  );
}
