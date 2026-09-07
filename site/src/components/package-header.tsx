/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from "@emotion/react";
import { Link, useNavigate } from "@tanstack/react-router";

import * as layoutStyles from "./layout.css";
import { useState } from "react";
import PackageSearch from "./package-search";

export function PackageHeader(props: {
  packageName: string;
  versions: string[];
  version: string;
  isLoading?: boolean;
}) {
  return (
    <header css={layoutStyles.header}>
      <div>
        <div css={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 css={layoutStyles.headerHeading}>{props.packageName}</h1>
          <VersionSelect
            packageName={props.packageName}
            version={props.version}
            versions={props.versions}
            isLoading={props.isLoading}
          />
        </div>
        <div css={{ display: "flex", gap: 4 }}>
          <Link
            to="/npm/$"
            params={{ _splat: `${props.packageName}@${props.version}` }}
          >
            Types
          </Link>
          <Link
            to="/src/$"
            params={{ _splat: `${props.packageName}@${props.version}` }}
          >
            Source
          </Link>
        </div>
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
  isLoading?: boolean;
}) {
  const navigate = useNavigate();
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
          setVersionState((x) => ({ ...x, current: newVersion }));
          void navigate({
            to: "/npm/$",
            params: { _splat: `${props.packageName}@${newVersion}` },
            hash: window.location.hash.slice(1),
          });
        }}
        value={versionState.current}
        disabled={
          props.isLoading ||
          versionState.current !== versionState.fromCurrentProps
        }
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
