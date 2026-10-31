import { describe, expect, it } from "vitest";
import { LANE_GBPS, rootBars, socketBars } from "./bars";

const widths = (blocks: { width: number }[]) => blocks.map((b) => b.width);
const marks = (blocks: { mark: string | null }[]) => blocks.map((b) => b.mark);

describe("socketBars", () => {
  it("gives one block per lane, as wide as a lane of its generation", () => {
    const bars = socketBars({ generation: 4, lanes: 2 }, { generation: 5, lanes: 1 });

    expect(widths(bars.needs!)).toEqual([LANE_GBPS[4], LANE_GBPS[4]]);
    expect(widths(bars.offers!)).toEqual([LANE_GBPS[5]]);
  });

  it("marks what the device needs beyond what the socket offers as a shortfall", () => {
    const bars = socketBars({ generation: 5, lanes: 8 }, { generation: 4, lanes: 4 });

    expect(marks(bars.needs!)).toEqual([null, null, "short", "short", "short", "short", "short", "short"]);
    expect(marks(bars.offers!)).toEqual([null, null, null, null]);
  });

  it("marks what the socket offers beyond what the device needs as spare", () => {
    const bars = socketBars({ generation: 2, lanes: 4 }, { generation: 5, lanes: 2 });

    expect(marks(bars.needs!)).toEqual([null, null, null, null]);
    expect(marks(bars.offers!)).toEqual([null, "spare"]);
  });

  it("shows only what an empty socket offers, all spare", () => {
    const bars = socketBars(null, { generation: 4, lanes: 2 });

    expect(bars.needs).toBeNull();
    expect(marks(bars.offers!)).toEqual(["spare", "spare"]);
  });

  it("shows no bars for a socket that offers nothing", () => {
    expect(socketBars({ generation: 4, lanes: 4 }, null)).toEqual({ needs: null, offers: null });
  });
});

describe("rootBars", () => {
  it("marks demanded lanes beyond the supply as an overcommit and unused supply as spare", () => {
    const over = rootBars(6, 4);
    const under = rootBars(2, 4);

    expect(marks(over.needs)).toEqual([null, null, null, null, "over", "over"]);
    expect(marks(over.gives)).toEqual([null, null, null, null]);
    expect(marks(under.gives)).toEqual([null, null, "spare", "spare"]);
    expect(widths(under.needs)).toEqual([1, 1]);
  });
});
