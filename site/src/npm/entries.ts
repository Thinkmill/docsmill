export type InputFilename = `/${string}`;

export type BaseFileName = string;

export type Directory = [string, Entry[]];

export type Entry = BaseFileName | Directory;

function splitPath(path: string) {
  const dirIndex = path.lastIndexOf("/");
  return {
    dir: path.slice(0, dirIndex),
    base: path.slice(dirIndex + 1),
  };
}

function filesToEntries(input: readonly `/${string}`[]): Entry[] {
  const files = [...input].sort();
  const root: Directory = ["", []];
  const directories = new Map<string, Entry[]>([root]);
  function getDirectory(name: string) {
    if (!directories.has(name)) {
      const { dir, base } = splitPath(name);
      const parent = getDirectory(dir);
      const entries: Entry[] = [];
      const directory: Directory = [base, entries];
      parent.push(directory);
      directories.set(name, entries);
    }
    return directories.get(name)!;
  }
  for (const file of files) {
    const { dir, base } = splitPath(file);
    const directory = getDirectory(dir);
    directory.push(base);
  }
  return root[1];
}

function collapseSingleChildTrees(entries: Entry[]): Entry[] {
  return entries
    .map((entry): Entry => {
      if (typeof entry !== "string") {
        const [name, children] = entry;
        const collapsed = collapseSingleChildTrees(children);
        if (children.length === 1) {
          const element = collapsed[0];
          if (typeof element === "string") {
            return `${name}/${element}`;
          }
          return [`${name}/${element[0]}`, element[1]];
        }
        return [name, collapsed];
      }
      return entry;
    })
    .sort((a, b) => {
      const aIsFile = typeof a !== "string";
      const bIsFile = typeof b !== "string";
      if (!aIsFile && bIsFile) {
        return 1;
      }
      if (aIsFile && !bIsFile) {
        return -1;
      }
      const aName = typeof a === "string" ? a : a[0];
      const bName = typeof b === "string" ? b : b[0];
      return aName.localeCompare(bName);
    });
}

export function getFileTree(input: readonly InputFilename[]): Entry[] {
  const entries = filesToEntries(input);
  return collapseSingleChildTrees(entries);
}
