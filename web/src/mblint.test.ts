import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { initSync } from "./wasm/mblint_wasm";
import { check, lint, type Files } from "./mblint";
import { boardPaths } from "./files";

const repo = join(import.meta.dirname, "../..");

/** Every file under `root`, keyed by its path relative to `root`. */
function readTree(root: string): Files {
  const files: Files = {};
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      const path = join(entry.parentPath, entry.name);
      files[relative(root, path).replaceAll("\\", "/")] = readFileSync(path, "utf8");
    }
  }
  return files;
}

beforeAll(() => {
  initSync({ module: readFileSync(join(import.meta.dirname, "wasm/mblint_wasm_bg.wasm")) });
});

describe("lint", () => {
  it("reports every reference board ok", () => {
    const files = readTree(join(repo, "data"));

    for (const board of boardPaths(files)) {
      expect(lint(files, board).status, board).toBe("ok");
    }
  });
});

describe("check", () => {
  const files = readTree(join(repo, "crates/mblint/tests/data"));

  it("returns the report of check --json", () => {
    const report = check(files, "rigs/warning.toml");

    expect(report.status).toBe("warning");
    expect(report.diagnostics[0].code).toBe("BOTTLENECK");
    expect(report.links["PCIE1"]?.lanes).toBe(4);
  });

  it("throws an Error naming a file absent from files", () => {
    expect(() => check(files, "rigs/missing_device.toml")).toThrow(/devices\/none\.toml/);
  });
});
