import { describe, expect, it } from "vitest";
import { dragWidth, moveBorder, PANE_MIN, SIDEBAR_MAX, SIDEBAR_MIN, storedHeights, storedWidth } from "./resize";

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

describe("moveBorder", () => {
  const open = [true, true, true];

  it("moves height from the open list below the border to the open list above it", () => {
    expect(moveBorder([200, 300, 100], open, 1, 50)).toEqual([250, 250, 100]);
    expect(moveBorder([200, 300, 100], open, 2, -50)).toEqual([200, 250, 150]);
  });

  it("passes over collapsed lists to the nearest open ones", () => {
    expect(moveBorder([200, 300, 100], [true, false, true], 1, 10)).toEqual([210, 300, 90]);
    expect(moveBorder([200, 300, 100], [true, false, true], 2, 20)).toEqual([220, 300, 80]);
  });

  it("keeps every list at least PANE_MIN high", () => {
    expect(moveBorder([200, 300, 100], open, 2, 500)).toEqual([200, 400 - PANE_MIN, PANE_MIN]);
    expect(moveBorder([200, 300, 100], open, 1, -500)).toEqual([PANE_MIN, 500 - PANE_MIN, 100]);
  });

  it("does not grow a list already lower than PANE_MIN against the drag", () => {
    expect(moveBorder([50, 300, 100], open, 1, -40)).toEqual([50, 300, 100]);
    expect(moveBorder([50, 300, 100], open, 1, 40)).toEqual([90, 260, 100]);
  });

  it("leaves the heights alone when no list is open on one side of the border", () => {
    expect(moveBorder([200, 300, 100], [false, true, true], 1, 50)).toEqual([200, 300, 100]);
  });
});

describe("storedHeights", () => {
  it("reads as many stored positive heights as there are lists, else nothing", () => {
    expect(storedHeights("[200,300,100]", 3)).toEqual([200, 300, 100]);
    expect(storedHeights("[200,300]", 3)).toBeNull();
    expect(storedHeights("[200,-1,100]", 3)).toBeNull();
    expect(storedHeights("tall", 3)).toBeNull();
    expect(storedHeights(null, 3)).toBeNull();
  });
});
