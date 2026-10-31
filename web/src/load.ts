import type { Files } from "./mblint";

/** A file the user loaded, by its name on disk. */
export type Loaded = { name: string; contents: string };

/** `files` with each loaded file under `local/<name>`, replacing a loaded file of the same name. */
export function addLoaded(files: Files, loaded: Loaded[]): Files {
  return { ...files, ...Object.fromEntries(loaded.map((file) => [`local/${file.name}`, file.contents])) };
}

/**
 * A loaded rig's board and bindings as paths in `files`: a path absent from `files` is taken from
 * a file loaded with the rig whose name is its last segment. Paths neither supplies are `missing`,
 * board first, and their bindings dropped.
 */
export function resolveRig(
  board: string,
  bindings: Record<string, string>,
  files: Files,
  loadedNames: string[],
): { board: string; bindings: Record<string, string>; missing: string[] } {
  const missing: string[] = [];
  const resolve = (path: string): string | null => {
    if (path in files) return path;
    const name = path.slice(path.lastIndexOf("/") + 1);
    if (loadedNames.includes(name)) return `local/${name}`;
    missing.push(path);
    return null;
  };
  const resolvedBoard = resolve(board) ?? board;
  const resolvedBindings: Record<string, string> = {};
  for (const [socket, device] of Object.entries(bindings)) {
    const path = resolve(device);
    if (path !== null) resolvedBindings[socket] = path;
  }
  return { board: resolvedBoard, bindings: resolvedBindings, missing };
}
