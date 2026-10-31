import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { initSync } from "./wasm/mblint_wasm";
import { catalog } from "./mblint";
import { rigToml } from "./rig";

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
