import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { initSync } from "./wasm/mblint_wasm";
import { catalog, layout } from "./mblint";
import { rigToml } from "./rig";
import { newFile, TEMPLATES } from "./templates";

beforeAll(() => {
  initSync({ module: readFileSync(join(import.meta.dirname, "wasm/mblint_wasm_bg.wasm")) });
});

describe("TEMPLATES", () => {
  it("are files the catalog reads as their kind", () => {
    const kinds = Object.fromEntries(
      Object.entries(TEMPLATES).map(([template, text]) => {
        const entry = catalog({ "local/x.toml": text })["local/x.toml"]!;
        return [template, entry.kind === "device" ? entry.type : entry.kind];
      }),
    );

    expect(kinds).toEqual({ board: "board", card: "card", "m2-module": "m2_module", adapter: "adapter", display: "display" });
  });

  it("give a board one root and one PCIe slot under it", () => {
    const files = { "local/b.toml": TEMPLATES.board, "local/rig.toml": rigToml("local/b.toml", {}) };
    const nodes = Object.values(layout(files, "local/rig.toml"));

    expect(nodes.map((node) => node.kind).sort()).toEqual(["root", "socket"]);
    expect(nodes.find((node) => node.kind === "socket")).toMatchObject({ category: "pcie_slot" });
  });
});

describe("newFile", () => {
  it("names the file after its template", () => {
    expect(newFile({}, "m2-module")).toEqual({ name: "new-m2-module.toml", contents: TEMPLATES["m2-module"] });
  });

  it("numbers the name from 2 when the name is taken, never replacing a file", () => {
    const files = { "local/new-card.toml": "", "local/new-card-2.toml": "", "local/new-card-4.toml": "" };

    expect(newFile(files, "card").name).toBe("new-card-3.toml");
  });
});
