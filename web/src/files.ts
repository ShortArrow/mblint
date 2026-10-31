import type { Files } from "./mblint";

/** Keys each of `modules` by its path under `root`, the prefix every key starts with. */
export function dataFiles(modules: Record<string, string>, root: string): Files {
  return Object.fromEntries(
    Object.entries(modules).map(([path, contents]) => [path.slice(root.length), contents]),
  );
}

/** The paths of the board files among `files`, in path order. */
export function boardPaths(files: Files): string[] {
  return Object.keys(files)
    .filter((path) => path.startsWith("boards/"))
    .sort();
}
