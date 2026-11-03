import { describe, expect, it } from "vitest";
import { addLoaded, isLoadableName, resolveRig, sameRig, toWrite } from "./load";

describe("addLoaded", () => {
  it("adds each loaded file under local/ by its name, replacing one of the same name", () => {
    const files = { "boards/a.toml": "a", "local/x.toml": "old" };

    const added = addLoaded(files, [
      { name: "x.toml", contents: "new" },
      { name: "y.toml", contents: "y" },
    ]);

    expect(added).toEqual({ "boards/a.toml": "a", "local/x.toml": "new", "local/y.toml": "y" });
  });
});

describe("resolveRig", () => {
  const files = { "boards/b.toml": "", "devices/c.toml": "", "local/d.toml": "" };

  it("keeps the paths found in files", () => {
    expect(resolveRig("boards/b.toml", { S1: "devices/c.toml" }, files)).toEqual({
      board: "boards/b.toml",
      bindings: { S1: "devices/c.toml" },
      missing: [],
    });
  });

  it("takes a path absent from files from a loaded file by its last segment, whenever it was loaded", () => {
    expect(resolveRig("boards/x/d.toml", { S1: "devices/y/d.toml" }, files)).toEqual({
      board: "local/d.toml",
      bindings: { S1: "local/d.toml" },
      missing: [],
    });
  });

  it("reads a path first from the files of the rig's repository", () => {
    const withRepository = { ...files, "github/a/r/boards/b.toml": "", "github/a/r/devices/x/c.toml": "" };

    expect(resolveRig("boards/b.toml", { S1: "devices/x/c.toml", S2: "devices/c.toml" }, withRepository, "github/a/r/")).toEqual({
      board: "github/a/r/boards/b.toml",
      bindings: { S1: "github/a/r/devices/x/c.toml", S2: "devices/c.toml" },
      missing: [],
    });
  });

  it("names each path neither files nor the loaded files supply", () => {
    const resolved = resolveRig("boards/none.toml", { S1: "devices/gone.toml" }, files);

    expect(resolved.missing).toEqual(["boards/none.toml", "devices/gone.toml"]);
    expect(resolved.bindings).toEqual({});
  });
});

describe("sameRig", () => {
  const rig = { board: "boards/b.toml", bindings: { S1: "devices/c.toml", S2: "local/d.toml" } };

  it("holds for the same board and bindings in any order", () => {
    expect(sameRig(rig, { board: "boards/b.toml", bindings: { S2: "local/d.toml", S1: "devices/c.toml" } })).toBe(true);
  });

  it("fails for another board, a binding more or less, or another device", () => {
    expect(sameRig(rig, { ...rig, board: "boards/x.toml" })).toBe(false);
    expect(sameRig(rig, { ...rig, bindings: { S1: "devices/c.toml" } })).toBe(false);
    expect(sameRig(rig, { ...rig, bindings: { ...rig.bindings, S3: "devices/c.toml" } })).toBe(false);
    expect(sameRig(rig, { ...rig, bindings: { ...rig.bindings, S2: "devices/c.toml" } })).toBe(false);
  });
});

describe("isLoadableName", () => {
  it("takes a plain file name, dots within it included", () => {
    expect(isLoadableName("x.toml")).toBe(true);
    expect(isLoadableName("a..b.toml")).toBe(true);
  });

  it("refuses a name that leaves its folder or names one", () => {
    for (const name of ["../x.toml", "a/x.toml", "..\\..\\x.toml", "a\\x.toml", ".", "..", ""]) {
      expect(isLoadableName(name), name).toBe(false);
    }
  });
});

describe("toWrite", () => {
  const named = {
    board: "boards/a.toml",
    bindings: { PCIE1: "devices/gpu.toml", M2_1: "devices/unloaded.toml", M2_2: "devices/ssd.toml" },
  };
  const files = {
    "github/o/r/boards/a.toml": "",
    "github/o/r/devices/gpu.toml": "",
    "github/o/r/devices/ssd.toml": "",
    "local/new.toml": "",
    "local/b.toml": "",
  };

  it("keeps the paths the rig names for what is unchanged, and writes new paths as in its repository or the page", () => {
    const built = {
      board: "github/o/r/boards/a.toml",
      bindings: { PCIE1: "github/o/r/devices/gpu.toml", M2_2: "local/new.toml", PCIE2: "github/o/r/devices/ssd.toml" },
    };

    expect(toWrite(named, built, files, "github/o/r/", true)).toEqual({
      board: "boards/a.toml",
      bindings: {
        PCIE1: "devices/gpu.toml",
        M2_1: "devices/unloaded.toml",
        M2_2: "local/new.toml",
        PCIE2: "devices/ssd.toml",
      },
    });
  });

  it("drops a binding whose file was not loaded when the rig is emptied", () => {
    expect(toWrite(named, { board: "local/b.toml", bindings: {} }, files, "github/o/r/", false)).toEqual({
      board: "local/b.toml",
      bindings: {},
    });
  });
});
