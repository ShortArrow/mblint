import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { initSync } from "./wasm/mblint_wasm";
import { downloadName, edit, MAX_EDIT_BYTES } from "./editor";
import { rigToml } from "./rig";

beforeAll(() => {
  initSync({ module: readFileSync(join(import.meta.dirname, "wasm/mblint_wasm_bg.wasm")) });
});

describe("edit", () => {
  const files = { "boards/b.toml": "board", "local/rig2.toml": rigToml("boards/b.toml", {}) };

  it("replaces the file at its path with a text the catalog reads", () => {
    const text = rigToml("boards/b.toml", { M2_1: "devices/ssd.toml" }, "edited");

    expect(edit(files, "local/rig2.toml", text)).toEqual({ files: { ...files, "local/rig2.toml": text } });
  });

  it("refuses a text the catalog cannot read, saying why with the line at fault", () => {
    const result = edit(files, "local/rig2.toml", 'schema_version = "2.0.0"\nname = \n');

    expect(result).not.toHaveProperty("files");
    expect((result as { refused: string }).refused).toMatch(/line 2/);
  });

  it("refuses a text longer than 1 MiB", () => {
    const text = `# ${"é".repeat(MAX_EDIT_BYTES / 2)}\n`;

    expect(MAX_EDIT_BYTES).toBe(1024 * 1024);
    expect(edit(files, "local/rig2.toml", text)).toEqual({ refused: "The text is longer than 1 MiB." });
  });
});

describe("downloadName", () => {
  it("names the download after the last segment of the path", () => {
    expect(downloadName("boards/asrock/z890.toml")).toBe("z890.toml");
    expect(downloadName("local/x.toml")).toBe("x.toml");
  });
});
