import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { initSync } from "./wasm/mblint_wasm";
import { catalog } from "./mblint";
import type { CatalogEntry } from "./report/CatalogEntry";
import { rigToml, takes } from "./rig";

beforeAll(() => {
  initSync({ module: readFileSync(join(import.meta.dirname, "wasm/mblint_wasm_bg.wasm")) });
});

describe("rigToml", () => {
  it("writes a rig the catalog reads back with its board and bindings", () => {
    const bindings = { "PCIEX16(G5)_1": "local/a \"quoted\".toml", M2_1: "devices/ssd.toml" };

    const entry = catalog({ "local/rig.toml": rigToml("boards/b.toml", bindings) })["local/rig.toml"];

    expect(entry).toEqual({ kind: "rig", name: "page", board: "boards/b.toml", bindings });
  });
});

describe("takes", () => {
  const entries: Record<string, CatalogEntry> = {
    "devices/ssd.toml": { kind: "device", name: "SSD", type: "m2_module", interface: null, socket_category: "m2_slot" },
    "boards/b.toml": { kind: "board", vendor: "v", model: "m" },
  };

  it("takes a device whose socket category is the socket's", () => {
    expect(takes(entries, "devices/ssd.toml", "m2_slot")).toBe(true);
  });

  it("refuses a device of another category, a file that is no device, and no part", () => {
    expect(takes(entries, "devices/ssd.toml", "pcie_slot")).toBe(false);
    expect(takes(entries, "boards/b.toml", "m2_slot")).toBe(false);
    expect(takes(entries, "../../x.toml", "m2_slot")).toBe(false);
    expect(takes(entries, null, "m2_slot")).toBe(false);
  });
});
