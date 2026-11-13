import { describe, expect, it } from "vitest";
import { searchTopic } from "./search";

/** A repository named `n` as GitHub's search API returns it. */
function repository(n: number) {
  return { full_name: `o/r${n}`, description: null, stargazers_count: n, pushed_at: "", html_url: "", extra: true };
}

/** A fetch answering each page of the search from `pages`, recording the requests. */
function fetchOf(pages: unknown[][], status = 200) {
  const requests: Request[] = [];
  const fetch = async (request: Request) => {
    requests.push(request);
    const page = Number(new URL(request.url).searchParams.get("page"));
    return new Response(JSON.stringify({ items: pages[page - 1] ?? [] }), { status });
  };
  return { requests, fetch };
}

describe("searchTopic", () => {
  it("asks GitHub for the public repositories with the topic, signed in with the token", async () => {
    const github = fetchOf([[repository(1)]]);
    await searchTopic("secret", github.fetch);
    const url = new URL(github.requests[0]!.url);
    expect(`${url.origin}${url.pathname}`).toBe("https://api.github.com/search/repositories");
    expect(url.searchParams.get("q")).toBe("topic:mblint-rig is:public");
    expect(github.requests[0]!.headers.get("authorization")).toBe("Bearer secret");
    expect(github.requests[0]!.headers.get("user-agent")).toBeTruthy();
  });

  it("keeps only the fields the listing reads", async () => {
    expect(await searchTopic("t", fetchOf([[repository(1)]]).fetch)).toEqual([
      { full_name: "o/r1", description: null, stargazers_count: 1, pushed_at: "", html_url: "" },
    ]);
  });

  it("reads page after page until one is not full", async () => {
    const full = Array.from({ length: 100 }, (_, i) => repository(i));
    const github = fetchOf([full, [repository(100)]]);
    expect(await searchTopic("t", github.fetch)).toHaveLength(101);
    expect(github.requests).toHaveLength(2);
  });

  it("fails when GitHub refuses", async () => {
    await expect(searchTopic("t", fetchOf([[]], 403).fetch)).rejects.toThrow("403");
  });
});
