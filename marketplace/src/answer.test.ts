import { describe, expect, it } from "vitest";
import { type Kept, HOUR, currentAnswer } from "./answer";
import type { Found } from "./listing";

const NOW = Date.UTC(2026, 10, 13, 12);
const OLD: Found[] = [{ full_name: "acme/old", description: null, stargazers_count: 1, pushed_at: "", html_url: "" }];
const NEW: Found[] = [{ full_name: "acme/new", description: null, stargazers_count: 2, pushed_at: "", html_url: "" }];

/** A store holding `kept`, recording what is put into it. */
function storeOf(kept: Kept | null) {
  const put: Kept[] = [];
  return { put, get: async () => kept, keep: async (next: Kept) => void put.push(next) };
}

/** A search answering `found`, counting how often it is asked. */
function searchOf(found: Found[] | Error) {
  const asked = { count: 0 };
  return {
    asked,
    search: async () => {
      asked.count += 1;
      if (found instanceof Error) throw found;
      return found;
    },
  };
}

describe("currentAnswer", () => {
  it("serves the kept answer without asking GitHub while it is younger than an hour", async () => {
    const store = storeOf({ at: NOW - HOUR + 1, found: OLD });
    const github = searchOf(NEW);
    expect(await currentAnswer(NOW, store, github.search)).toEqual({ kind: "answer", at: NOW - HOUR + 1, found: OLD });
    expect(github.asked.count).toBe(0);
  });

  it("asks GitHub and keeps its answer once the kept answer is an hour old", async () => {
    const store = storeOf({ at: NOW - HOUR, found: OLD });
    expect(await currentAnswer(NOW, store, searchOf(NEW).search)).toEqual({ kind: "answer", at: NOW, found: NEW });
    expect(store.put).toEqual([{ at: NOW, found: NEW }]);
  });

  it("asks GitHub when nothing is kept", async () => {
    expect(await currentAnswer(NOW, storeOf(null), searchOf(NEW).search)).toEqual({ kind: "answer", at: NOW, found: NEW });
  });

  it("serves the last kept answer, with when it was taken, when GitHub cannot be reached", async () => {
    const store = storeOf({ at: NOW - 3 * HOUR, found: OLD });
    expect(await currentAnswer(NOW, store, searchOf(new Error("down")).search)).toEqual({
      kind: "answer",
      at: NOW - 3 * HOUR,
      found: OLD,
    });
  });

  it("says GitHub cannot be reached when nothing is kept and GitHub cannot be reached", async () => {
    expect(await currentAnswer(NOW, storeOf(null), searchOf(new Error("down")).search)).toEqual({ kind: "unreachable" });
  });

  it("is busy without asking GitHub when the kept answer cannot be read", async () => {
    const github = searchOf(NEW);
    const store = { get: async () => Promise.reject(new Error("limit")), keep: async () => {} };
    expect(await currentAnswer(NOW, store, github.search)).toEqual({ kind: "busy" });
    expect(github.asked.count).toBe(0);
  });

  it("serves GitHub's answer even when it cannot be kept", async () => {
    const store = { get: async () => null, keep: async () => Promise.reject(new Error("limit")) };
    expect(await currentAnswer(NOW, store, searchOf(NEW).search)).toEqual({ kind: "answer", at: NOW, found: NEW });
  });
});
