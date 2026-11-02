import { describe, expect, it } from "vitest";
import { crc32, rigBundle, zip } from "./export";

describe("rigBundle", () => {
  const files = {
    "boards/asus/b.toml": "board",
    "devices/cards/c.toml": "card",
    "local/my_board.toml": "loaded board",
    "local/my_card.toml": "loaded card",
  };

  it("keeps data paths and places loaded files under boards/ and devices/, naming them so in the rig", () => {
    const bundle = rigBundle(files, "local/my_board.toml", { S1: "devices/cards/c.toml", S2: "local/my_card.toml" }, "desk");

    expect(Object.keys(bundle).sort()).toEqual(["boards/my_board.toml", "devices/cards/c.toml", "devices/my_card.toml", "rigs/desk.toml"]);
    expect(bundle["boards/my_board.toml"]).toBe("loaded board");
    expect(bundle["devices/my_card.toml"]).toBe("loaded card");
    expect(bundle["rigs/desk.toml"]).toContain('name = "desk"');
    expect(bundle["rigs/desk.toml"]).toContain('board = "boards/my_board.toml"');
    expect(bundle["rigs/desk.toml"]).toContain('"S2" = "devices/my_card.toml"');
  });

  it("writes a device installed in several sockets once", () => {
    const bundle = rigBundle(files, "boards/asus/b.toml", { S1: "devices/cards/c.toml", S2: "devices/cards/c.toml" }, "rig");

    expect(Object.keys(bundle).sort()).toEqual(["boards/asus/b.toml", "devices/cards/c.toml", "rigs/rig.toml"]);
  });
});

describe("crc32", () => {
  it("gives the check value of the standard", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

/** The names and texts of the entries in a stored zip archive, read through its central directory. */
function unzip(bytes: Uint8Array): Record<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    expect(view.getUint32(offset, true)).toBe(0x04034b50);
    const data = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    const content = bytes.subarray(data, data + size);
    expect(view.getUint32(at + 16, true)).toBe(crc32(content));
    entries[name] = decoder.decode(content);
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return entries;
}

describe("zip", () => {
  it("stores each entry under its path, readable through the central directory", () => {
    const entries = { "rigs/r.toml": 'name = "r"\n', "devices/ü.toml": "x" };

    expect(unzip(zip(entries))).toEqual(entries);
  });
});
