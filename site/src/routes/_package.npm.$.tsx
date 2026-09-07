import { createFileRoute } from "@tanstack/react-router";
import { PackageDocs } from "../components/package-docs";
import { loadPackageDocsInBrowser } from "../workers/client";

export const Route = createFileRoute("/_package/npm/$")({
  ssr: false,
  loader: ({ params }) => loadPackageDocsInBrowser(params._splat ?? ""),
  pendingComponent: () => (
    <main style={{ margin: 16 }}>Building package documentation…</main>
  ),
  component: NpmPackage,
});

function NpmPackage() {
  const data = Route.useLoaderData();
  return <PackageDocs {...data} />;
}
