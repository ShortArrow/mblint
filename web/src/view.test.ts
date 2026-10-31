import { describe, expect, it } from "vitest";
import { lintLines } from "./view";

describe("lintLines", () => {
  it("shows the status, then each diagnostic's severity and message", () => {
    const lines = lintLines({
      status: "error",
      diagnostics: [
        { severity: "error", message: "The node id a.b contains a dot.", code: "INVALID_NODE_ID", node: "a.b" },
      ],
    });

    expect(lines).toEqual(["status: error", "error: The node id a.b contains a dot."]);
  });
});
