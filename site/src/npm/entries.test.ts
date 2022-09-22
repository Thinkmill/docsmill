import { Entry, getFileTree, InputFilename } from "./entries";

const cases: [InputFilename[], Entry[]][] = [
  [["/index.ts"], ["index.ts"]],
  [
    ["/index.ts", "/something/index.ts", "/other/index.ts"],
    ["index.ts", "other/index.ts", "something/index.ts"],
  ],
  [
    ["/index.ts", "/something/index.ts", "/something/other.ts"],
    ["index.ts", ["something", ["index.ts", "other.ts"]]],
  ],
];

for (const [input, output] of cases) {
  test(`${JSON.stringify(input)} -> ${JSON.stringify(output)}`, () => {
    expect(getFileTree(input)).toEqual(output);
  });
}
