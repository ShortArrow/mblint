import { describe, expect, it } from "vitest";
import { flag, flagValue } from "./prefs";

describe("prefs", () => {
  it("reads a stored flag, else the fallback", () => {
    expect(flag("on", false)).toBe(true);
    expect(flag("off", true)).toBe(false);
    expect(flag(null, true)).toBe(true);
    expect(flag("bogus", false)).toBe(false);
  });

  it("writes a flag as it is read", () => {
    expect(flag(flagValue(true), false)).toBe(true);
    expect(flag(flagValue(false), true)).toBe(false);
  });
});
