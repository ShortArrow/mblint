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
  const needed = needs === null ? 0 : rate(needs);
  return {
    needs: needs === null ? null : lanes(needs, rate(offers), "short"),
    offers: lanes(offers, needed, "spare"),
  };
}

/** The lanes a root's children demand above the lanes it supplies, one unit per lane. */
export function rootBars(demanded: number, supplied: number): { needs: Block[]; gives: Block[] } {
  const unit = (count: number, limit: number, mark: Block["mark"]): Block[] =>
    Array.from({ length: count }, (_, i) => ({ width: 1, mark: i >= limit ? mark : null }));
  return { needs: unit(demanded, supplied, "over"), gives: unit(supplied, demanded, "spare") };
}

function rate(link: LinkWidth): number {
  return (LANE_GBPS[link.generation] ?? 0) * link.lanes;
}

function lanes(link: LinkWidth, other: number, mark: Block["mark"]): Block[] {
  const width = LANE_GBPS[link.generation] ?? 0;
  return Array.from({ length: link.lanes }, (_, i) => ({
    width,
    mark: (i + 0.5) * width > other ? mark : null,
  }));
}
