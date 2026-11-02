import type { LinkWidth } from "./report/LinkWidth";

/** Data rate of one PCIe lane after line encoding, in Gbps, by generation. */
export const LANE_GBPS: Record<number, number> = {
  1: 2.5 * (8 / 10),
  2: 5 * (8 / 10),
  3: 8 * (128 / 130),
  4: 16 * (128 / 130),
  5: 32 * (128 / 130),
};

/** One lane of a bar: its width on the bar's scale, and whether it is a shortfall, an overcommit or spare. */
export type Block = { width: number; mark: "short" | "over" | "spare" | null };

/**
 * What a device needs above what its socket offers, on one scale of Gbps, as `docs/spec/web.md`
 * specifies. A block is marked when its middle lies beyond the other bar's end.
 */
export function socketBars(
  needs: LinkWidth | null,
  offers: LinkWidth | null,
): { needs: Block[] | null; offers: Block[] | null } {
  if (offers === null) return { needs: null, offers: null };
  const needed = needs === null ? 0 : linkGbps(needs);
  return {
    needs: needs === null ? null : lanes(needs, linkGbps(offers), "short"),
    offers: lanes(offers, needed, "spare"),
  };
}

/** The lanes a root's children demand above the lanes it supplies, one unit per lane. */
export function rootBars(demanded: number, supplied: number): { needs: Block[]; gives: Block[] } {
  const unit = (count: number, limit: number, mark: Block["mark"]): Block[] =>
    count > MAX_BLOCKS
      ? merged(count, Math.min(count, limit), 1, mark)
      : Array.from({ length: count }, (_, i) => ({ width: 1, mark: i >= limit ? mark : null }));
  return { needs: unit(demanded, supplied, "over"), gives: unit(supplied, demanded, "spare") };
}

/** The most lanes a bar draws one block per lane; a longer bar is drawn as `merged` blocks. */
export const MAX_BLOCKS = 64;

/** The data rate of a link in Gbps: its lanes at the rate of a lane of its generation. */
export function linkGbps(link: LinkWidth): number {
  return (LANE_GBPS[link.generation] ?? 0) * link.lanes;
}

/** Pixels per unit that draw the longest of `lengths` `width` pixels wide, or 0 when none is longer than 0. */
export function scaleFor(lengths: number[], width: number): number {
  const longest = Math.max(0, ...lengths);
  return longest > 0 ? width / longest : 0;
}

function lanes(link: LinkWidth, other: number, mark: Block["mark"]): Block[] {
  const width = LANE_GBPS[link.generation] ?? 0;
  if (link.lanes > MAX_BLOCKS) {
    const unmarked = width > 0 ? Math.floor(other / width - 0.5) + 1 : link.lanes;
    return merged(link.lanes, Math.max(0, Math.min(link.lanes, unmarked)), width, mark);
  }
  return Array.from({ length: link.lanes }, (_, i) => ({
    width,
    mark: (i + 0.5) * width > other ? mark : null,
  }));
}

/** `count` lanes of `width` as one block of the first `unmarked` lanes and one of the rest, leaving out an empty one. */
function merged(count: number, unmarked: number, width: number, mark: Block["mark"]): Block[] {
  const runs: [number, Block["mark"]][] = [
    [unmarked, null],
    [count - unmarked, mark],
  ];
  return runs.flatMap(([lanes, mark]) => (lanes > 0 ? [{ width: lanes * width, mark }] : []));
}
