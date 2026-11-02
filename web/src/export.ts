import type { Files } from "./mblint";
import { rigToml } from "./rig";

/**
 * The files of the rig `name` on `board` with `bindings`, keyed by their path under a data root:
 * the rig at `rigs/<name>.toml`, and each file it names at its path in `files`, except that a
 * loaded board goes to `boards/<file name>` and a loaded device to `devices/<file name>`, where the
 * rig names them.
 */
export function rigBundle(files: Files, board: string, bindings: Record<string, string>, name: string): Record<string, string> {
  const bundle: Record<string, string> = {};
  const place = (path: string, folder: string): string => {
    const placed = path.startsWith("local/") ? `${folder}/${path.slice("local/".length)}` : path;
    bundle[placed] = files[path] ?? "";
    return placed;
  };
  const placedBoard = place(board, "boards");
  const placedBindings = Object.fromEntries(
    Object.entries(bindings).map(([socket, device]) => [socket, place(device, "devices")]),
  );
  bundle[`rigs/${name}.toml`] = rigToml(placedBoard, placedBindings, name);
  return bundle;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** The CRC-32 of `bytes`, as zip archives record it. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Little-endian bytes of `values`, each written in the width of bytes paired with it. */
function fields(...values: [number, 2 | 4][]): number[] {
  return values.flatMap(([value, width]) => Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff));
}

/**
 * A zip archive storing each entry uncompressed under its path, with UTF-8 names and the date
 * 1980-01-01.
 */
export function zip(entries: Record<string, string>): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const UTF8 = 0x0800;
  const DATE = (1 << 5) | 1;
  const locals: number[] = [];
  const central: number[] = [];
  const names = Object.keys(entries);
  for (const path of names) {
    const name = encoder.encode(path);
    const data = encoder.encode(entries[path]!);
    const crc = crc32(data);
    const offset = locals.length;
    const common: [number, 2 | 4][] = [[20, 2], [UTF8, 2], [0, 2], [0, 2], [DATE, 2], [crc, 4], [data.length, 4], [data.length, 4], [name.length, 2], [0, 2]];
    locals.push(...fields([0x04034b50, 4], ...common), ...name, ...data);
    central.push(...fields([0x02014b50, 4], [20, 2], ...common, [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]), ...name);
  }
  const end = fields([0x06054b50, 4], [0, 2], [0, 2], [names.length, 2], [names.length, 2], [central.length, 4], [locals.length, 4], [0, 2]);
  return Uint8Array.from([...locals, ...central, ...end]);
}
