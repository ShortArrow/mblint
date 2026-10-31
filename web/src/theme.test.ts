import { describe, expect, it } from "vitest";
import { coverRadius, resolveTheme, toggleTheme } from "./theme";

describe("theme", () => {
  it("uses a stored theme, else the system's", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme("bogus", false)).toBe("light");
  });

  it("toggles between light and dark", () => {
    expect(toggleTheme("light")).toBe("dark");
    expect(toggleTheme("dark")).toBe("light");
  });

  it("covers the whole area from the point the circle grows from", () => {
    expect(coverRadius(0, 0, 3, 4)).toBe(5);
    expect(coverRadius(3, 4, 3, 4)).toBe(5);
  });
});
