import type { CatalogEntry } from "./report/CatalogEntry";
import type { SocketCategory } from "./report/SocketCategory";

/** The rig file named `name`, `page` unless given, on `board` with `bindings`. */
export function rigToml(board: string, bindings: Record<string, string>, name = "page"): string {
  const lines = [
    'schema_version = "2.0.0"',
    `name = ${JSON.stringify(name)}`,
    `board = ${JSON.stringify(board)}`,
    "",
    "[bindings]",
    ...Object.entries(bindings).map(([socket, device]) => `${JSON.stringify(socket)} = ${JSON.stringify(device)}`),
  ];
  return `${lines.join("\n")}\n`;
}

/** Whether a socket of `category` takes the part at `part` in `entries`: a device of that socket category. */
export function takes(entries: Record<string, CatalogEntry>, part: string | null, category: SocketCategory): boolean {
  const entry = part === null ? undefined : entries[part];
  return entry?.kind === "device" && entry.socket_category === category;
}
