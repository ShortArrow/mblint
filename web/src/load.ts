import type { Files } from "./mblint";

/** A file the user loaded, by its name on disk. */
export type Loaded = { name: string; contents: string };

/** Whether a file of this name may be added under `local/`: a name that stays in that folder and names a file. */
export function isLoadableName(name: string): boolean {
  return name !== "" && name !== "." && name !== ".." && !/[/\\]/.test(name);
}

/** `files` with each loaded file under `local/<name>`, replacing a loaded file of the same name. */
export function addLoaded(files: Files, loaded: Loaded[]): Files {
  return { ...files, ...Object.fromEntries(loaded.map((file) => [`local/${file.name}`, file.contents])) };
}

/**
 * A rig's board and bindings as paths in `files`: a path is read first under `root`, the prefix of
 * the repository the rig was loaded from, then as it is, then from the loaded file `local/<name>`
 * whose name is its last segment. Paths none supplies are `missing`, board first, and their
 * bindings dropped.
 */
export function resolveRig(
  board: string,
  bindings: Record<string, string>,
  files: Files,
  root = "",
): { board: string; bindings: Record<string, string>; missing: string[] } {
  const missing: string[] = [];
  const resolve = (path: string): string | null => {
    const found = resolvePath(path, files, root);
    if (found === null) missing.push(path);
    return found;
  };
  const resolvedBoard = resolve(board) ?? board;
  const resolvedBindings: Record<string, string> = {};
  for (const [socket, device] of Object.entries(bindings)) {
    const path = resolve(device);
    if (path !== null) resolvedBindings[socket] = path;
  }
  return { board: resolvedBoard, bindings: resolvedBindings, missing };
}

/**
 * The path in `files` that a rig from the repository whose prefix is `root` means by `path`: under
 * `root` first, then as it is, then the loaded file `local/<name>` whose name is its last segment;
 * null when none is in `files`.
 */
function resolvePath(path: string, files: Files, root: string): string | null {
  if (root !== "" && `${root}${path}` in files) return `${root}${path}`;
  if (path in files) return path;
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (`local/${name}` in files) return `local/${name}`;
  return null;
}

/** A board with the device installed in each socket. */
export type Rig = { board: string; bindings: Record<string, string> };

/** Whether `a` and `b` have the same board and install the same device in the same sockets. */
export function sameRig(a: Rig, b: Rig): boolean {
  const sockets = Object.keys(a.bindings);
  return (
    a.board === b.board &&
    sockets.length === Object.keys(b.bindings).length &&
    sockets.every((socket) => a.bindings[socket] === b.bindings[socket])
  );
}

/**
 * The board and bindings to write into a rig file that names `named`, from the repository whose
 * prefix is `root`, so that it holds `built`, a rig as paths in `files`. A path the change leaves
 * alone keeps the rig's spelling, and a binding whose file is not in `files` stays when
 * `keepUnloaded`; a new path is written without `root`.
 */
export function toWrite(named: Rig, built: Rig, files: Files, root: string, keepUnloaded: boolean): Rig {
  const spell = (path: string) => (root !== "" && path.startsWith(root) ? path.slice(root.length) : path);
  const bindings: Record<string, string> = {};
  for (const [socket, path] of Object.entries(named.bindings)) {
    const resolved = resolvePath(path, files, root);
    if (resolved === null ? keepUnloaded && !(socket in built.bindings) : built.bindings[socket] === resolved) {
      bindings[socket] = path;
    }
  }
  for (const [socket, path] of Object.entries(built.bindings)) bindings[socket] ??= spell(path);
  const board = resolvePath(named.board, files, root) === built.board ? named.board : spell(built.board);
  return { board, bindings };
}
