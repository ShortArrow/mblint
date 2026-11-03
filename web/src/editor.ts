import { catalog, type Files } from "./mblint";

/** The longest text the editor takes for a file, in bytes of UTF-8. */
export const MAX_EDIT_BYTES = 1024 * 1024;

/**
 * `files` with `text` as the file at `path`, or why `text` is not taken: it is longer than
 * `MAX_EDIT_BYTES`, or `catalog` cannot read it, in which case its message names the line at fault.
 */
export function edit(files: Files, path: string, text: string): { files: Files } | { refused: string } {
  if (new TextEncoder().encode(text).length > MAX_EDIT_BYTES) return { refused: "The text is longer than 1 MiB." };
  const entry = catalog({ [path]: text })[path]!;
  if (entry.kind === "invalid") return { refused: entry.message };
  return { files: { ...files, [path]: text } };
}

/** The name the file at `path` is downloaded as: the last segment of its path. */
export function downloadName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
