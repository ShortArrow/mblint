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
