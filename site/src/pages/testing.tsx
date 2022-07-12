import { highlighterPromise } from "../extract/highlight";
export { default } from "./lib";
import { getInfo } from "../local-extract";

export async function getStaticProps() {
  await highlighterPromise;
  return {
    props: getInfo("src/test-input.ts"),
  };
}
