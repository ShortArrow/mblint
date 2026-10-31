import { describe, expect, it } from "vitest";
import { addLoaded, resolveRig } from "./load";

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
    expect(resolveRig("boards/b.toml", { S1: "devices/c.toml" }, files, [])).toEqual({
      board: "boards/b.toml",
      bindings: { S1: "devices/c.toml" },
      missing: [],
    });
  });

  it("takes a path absent from files from a file loaded with the rig by its last segment", () => {
    expect(resolveRig("boards/x/d.toml", { S1: "devices/y/d.toml" }, files, ["d.toml"])).toEqual({
      board: "local/d.toml",
      bindings: { S1: "local/d.toml" },
      missing: [],
    });
  });

  it("names each path neither files nor the loaded files supply", () => {
    const resolved = resolveRig("boards/none.toml", { S1: "devices/gone.toml" }, files, []);

    expect(resolved.missing).toEqual(["boards/none.toml", "devices/gone.toml"]);
    expect(resolved.bindings).toEqual({});
  });
});
