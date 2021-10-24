import { getFromLocalPackage } from "../local-extract";

export { Root as default } from "../components/root";

export async function getStaticProps() {
  return {
    props: await getFromLocalPackage(
      "../graphql-ts/tsconfig.json",
      "../graphql-ts/packages/extend"
    ),
  };
}
