/** The narrowest and the widest a sidebar may be, in pixels. */
export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 480;

/** Which side of the page a sidebar is on; its inner edge faces the other side. */
export type Side = "left" | "right";

/** The width of a sidebar `start` pixels wide after its inner edge moves from `from` to `to`, within the limits. */
export function dragWidth(side: Side, start: number, from: number, to: number): number {
  return clampWidth(side === "left" ? start + (to - from) : start - (to - from));
}

/** The width stored as `stored`, within the limits, or `fallback` when no number is stored. */
export function storedWidth(stored: string | null, fallback: number): number {
  const width = stored === null ? Number.NaN : Number(stored);
  return Number.isFinite(width) ? clampWidth(width) : fallback;
}

function clampWidth(width: number): number {
  return Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width)));
}

/** The lowest a list in a sidebar may be, in pixels. */
export const PANE_MIN = 80;

/**
 * The heights of a sidebar's lists after the border above list `border` moves down by `delta` pixels: the nearest
 * open list above the border gains what the nearest open list below it loses, neither being moved below `PANE_MIN`.
 */
export function moveBorder(heights: number[], open: boolean[], border: number, delta: number): number[] {
  const above = open.lastIndexOf(true, border - 1);
  const below = open.indexOf(true, border);
  if (border < 1 || above < 0 || below < 0) return heights;
  const moved = Math.min(Math.max(0, heights[below] - PANE_MIN), Math.max(Math.min(0, PANE_MIN - heights[above]), delta));
  return heights.map((height, index) => (index === above ? height + moved : index === below ? height - moved : height));
}

/** The `count` heights stored as `stored`, or null when they are not `count` positive numbers. */
export function storedHeights(stored: string | null, count: number): number[] | null {
  try {
    const heights: unknown = JSON.parse(stored ?? "null");
    return Array.isArray(heights) && heights.length === count && heights.every((height) => typeof height === "number" && height > 0)
      ? heights
      : null;
  } catch {
    return null;
  }
}
