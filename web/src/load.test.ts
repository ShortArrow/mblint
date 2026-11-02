import { describe, expect, it } from "vitest";
import { addLoaded, resolveRig, sameRig } from "./load";

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
