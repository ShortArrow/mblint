import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { initSync } from "./wasm/mblint_wasm";
import { catalog, check, layout, lint, rebind, type Files } from "./mblint";
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

describe("catalog", () => {
  it("says what each file is by its contents", () => {
    const files = readTree(join(repo, "crates/mblint/tests/data"));

    const entries = catalog(files);

    expect(entries["boards/test/board.toml"]?.kind).toBe("board");
    expect(entries["devices/card.toml"]?.kind).toBe("device");
    expect(entries["rigs/warning.toml"]?.kind).toBe("rig");
  });
});

describe("layout", () => {
  it("lays out the board of a rig", () => {
    const files = readTree(join(repo, "crates/mblint/tests/data"));

    const nodes = layout(files, "rigs/warning.toml");
    const slot = nodes["PCIE1"];

    expect(slot?.kind).toBe("socket");
    expect(slot?.kind === "socket" && slot.device).toBe("devices/card.toml");
  });
});

describe("rebind", () => {
  it("sets a rig's board and bindings, keeping its comments", () => {
    const rig = `# mine
schema_version = "2.0.0"
name = "x"
board = "a.toml"

[bindings]
PCIE1 = "g.toml" # big
`;

    expect(rebind(rig, "b.toml", { PCIE1: "h.toml" })).toBe(rig.replace("a.toml", "b.toml").replace("g.toml", "h.toml"));
  });

  it("throws on a text that is not a rig", () => {
    expect(() => rebind('vendor = "x"\n', "b.toml", {})).toThrow();
  });
});
