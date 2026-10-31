import { describe, expect, it } from "vitest";
import { coverRadius, resolveTheme, themeChoice } from "./theme";

describe("theme", () => {
  it("uses a stored theme, else the system's", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme("bogus", false)).toBe("light");
  });

  it("reads the stored choice, which is the system's theme unless light or dark is stored", () => {
    expect(themeChoice("dark")).toBe("dark");
    expect(themeChoice("light")).toBe("light");
    expect(themeChoice(null)).toBe("system");
    expect(themeChoice("bogus")).toBe("system");
  });

  it("covers the whole area from the point the circle grows from", () => {
    expect(coverRadius(0, 0, 3, 4)).toBe(5);
    expect(coverRadius(3, 4, 3, 4)).toBe(5);
  });
});
