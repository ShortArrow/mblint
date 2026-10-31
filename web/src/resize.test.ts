import { describe, expect, it } from "vitest";
import { dragWidth, SIDEBAR_MAX, SIDEBAR_MIN, storedWidth } from "./resize";

describe("dragWidth", () => {
  it("widens a left sidebar as its edge moves right, and a right sidebar as its edge moves left", () => {
    expect(dragWidth("left", 230, 100, 150)).toBe(280);
    expect(dragWidth("right", 280, 500, 450)).toBe(330);
  });

  it("keeps the width between the limits", () => {
    expect(dragWidth("left", 230, 100, -500)).toBe(SIDEBAR_MIN);
    expect(dragWidth("right", 280, 500, -500)).toBe(SIDEBAR_MAX);
  });
});

describe("storedWidth", () => {
  it("reads a stored width within the limits, else the fallback", () => {
    expect(storedWidth("300", 230)).toBe(300);
    expect(storedWidth("9999", 230)).toBe(SIDEBAR_MAX);
    expect(storedWidth(null, 230)).toBe(230);
    expect(storedWidth("wide", 230)).toBe(230);
  });
});
