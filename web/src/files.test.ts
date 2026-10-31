import { describe, expect, it } from "vitest";
import { boardPaths, dataFiles } from "./files";

describe("dataFiles", () => {
  it("keys each file by its path under the data root", () => {
    const files = dataFiles(
      { "../../data/boards/a/b.toml": "x", "../../data/rigs/r.toml": "y" },
      "../../data/",
    );

    expect(files).toEqual({ "boards/a/b.toml": "x", "rigs/r.toml": "y" });
  });
});

describe("boardPaths", () => {
  it("lists the board files in path order", () => {
    const files = { "rigs/r.toml": "", "boards/z/b.toml": "", "boards/a/c.toml": "" };

    expect(boardPaths(files)).toEqual(["boards/a/c.toml", "boards/z/b.toml"]);
  });
});
