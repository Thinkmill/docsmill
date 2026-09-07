import { createFileRoute } from "@tanstack/react-router";
import { PackageSearch } from "../components/package-search";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        marginTop: 240,
      }}
    >
      <div style={{ maxWidth: 600, flex: 1 }}>
        <PackageSearch autoFocus />
      </div>
    </div>
  );
}
