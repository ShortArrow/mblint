import { describe, expect, it } from "vitest";
import { type Env, handle } from "./worker";

const NOW = Date.UTC(2026, 10, 13, 12);

/** An environment whose KV holds `kept` under the key the worker reads, and records what is put. */
function envOf(kept: string | null): Env & { put: [string, string][] } {
  const put: [string, string][] = [];
  return {
    put,
    GITHUB_TOKEN: "secret",
    LISTING: {
      get: async (key: string) => (key === "answer" ? kept : null),
      put: async (key: string, value: string) => void put.push([key, value]),
    },
  };
}

/** A fetch answering GitHub's search with the repository `acme/rigs`. */
const github = async () =>
  new Response(
    JSON.stringify({
      items: [{ full_name: "acme/rigs", description: null, stargazers_count: 1, pushed_at: "", html_url: "https://github.com/acme/rigs" }],
    }),
  );

describe("handle", () => {
  it("answers the page as HTML, listing what GitHub found, and keeps GitHub's answer", async () => {
    const env = envOf(null);
    const response = await handle(new Request("https://marketplace.mblint.shortarrow.jp/"), env, NOW, github);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toContain("acme/rigs");
    expect(env.put.map(([key]) => key)).toEqual(["answer"]);
  });

  it("narrows the list by the text in the address's q", async () => {
    const response = await handle(new Request("https://marketplace.mblint.shortarrow.jp/?q=zeta"), envOf(null), NOW, github);
    expect(await response.text()).not.toContain("https://github.com/acme/rigs");
  });

  it("answers 503 when the marketplace is busy", async () => {
    const env = envOf(null);
    env.LISTING.get = async () => Promise.reject(new Error("limit"));
    expect((await handle(new Request("https://marketplace.mblint.shortarrow.jp/"), env, NOW, github)).status).toBe(503);
  });

  it("answers 404 for any other path", async () => {
    expect((await handle(new Request("https://marketplace.mblint.shortarrow.jp/x"), envOf(null), NOW, github)).status).toBe(404);
  });
});
