import {
  createFileRoute,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { PackageHeader } from "../components/package-header";
import { parsePackageRef } from "../npm/params";

type PackageHeaderData = {
  packageName: string;
  version: string;
  versions: string[];
};

export const Route = createFileRoute("/_package")({
  component: PackageLayout,
});

function PackageLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const requested = parsePackageRef(
    decodeURIComponent(pathname.replace(/^\/(?:npm|src)\//, "")),
  );
  const loaded = useRouterState({
    select: (state) => {
      for (let index = state.matches.length - 1; index >= 0; index--) {
        const data = state.matches[index].loaderData as
          Partial<PackageHeaderData> | undefined;
        if (
          data?.packageName === requested.packageName &&
          data.version === requested.version &&
          Array.isArray(data.versions)
        ) {
          return data as PackageHeaderData;
        }
      }
      return undefined;
    },
  });
  const header = loaded ?? {
    ...requested,
    versions: [requested.version],
  };

  return (
    <>
      <PackageHeader {...header} isLoading={loaded === undefined} />
      <Outlet />
    </>
  );
}
