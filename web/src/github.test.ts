import { describe, expect, it } from "vitest";
import { fetchRoot, MAX_ROOT_FILES, parseAddress, rootOf, withRepository } from "./github";

describe("parseAddress", () => {
  it("reads a repository's default branch", () => {
    expect(parseAddress("https://github.com/acme/rigs")).toEqual({ owner: "acme", repo: "rigs", ref: null, path: "" });
    expect(parseAddress(" https://github.com/acme/rigs.git/ ")).toEqual({ owner: "acme", repo: "rigs", ref: null, path: "" });
  });

  it("reads a folder at a branch, tag or commit", () => {
    expect(parseAddress("https://github.com/acme/rigs/tree/v1/data/home")).toEqual({
      owner: "acme",
      repo: "rigs",
      ref: "v1",
      path: "data/home",
    });
    expect(parseAddress("https://github.com/acme/rigs/tree/main")).toEqual({ owner: "acme", repo: "rigs", ref: "main", path: "" });
  });

  it("refuses an address that is not a repository on github.com", () => {
    expect(parseAddress("https://gitlab.com/acme/rigs")).toBeNull();
    expect(parseAddress("https://github.com/acme")).toBeNull();
    expect(parseAddress("https://github.com/acme/rigs/blob/main/a.toml")).toBeNull();
    expect(parseAddress("http://github.com/acme/rigs")).toBeNull();
    expect(parseAddress("https://github.com/acme/../rigs")).toBeNull();
  });
});

describe("rootOf", () => {
  it("is the repository a path was loaded from", () => {
    expect(rootOf("github/acme/rigs/rigs/home.toml")).toBe("github/acme/rigs/");
    expect(rootOf("local/rig.toml")).toBe("");
  });
});

describe("withRepository", () => {
  it("replaces the files loaded from the same repository before, keeping every other", () => {
    const files = { "boards/b.toml": "b", "github/acme/rigs/old.toml": "old", "github/acme/other/x.toml": "x" };

    expect(withRepository(files, "github/acme/rigs/", { "github/acme/rigs/new.toml": "new" })).toEqual({
      "boards/b.toml": "b",
      "github/acme/other/x.toml": "x",
      "github/acme/rigs/new.toml": "new",
    });
  });
});

/** A fetch answering each URL from `routes`, with 404 for any other. */
function fakeFetch(routes: Record<string, { status?: number; json?: unknown; text?: string; headers?: Record<string, string> }>) {
  const asked: string[] = [];
  const fetch = async (url: string) => {
    asked.push(url);
    const route = routes[url];
    return new Response(route?.json !== undefined ? JSON.stringify(route.json) : (route?.text ?? ""), {
      status: route ? (route.status ?? 200) : 404,
      headers: route?.headers,
    });
  };
  return { fetch, asked };
}

const API = "https://api.github.com/repos/acme/rigs";
const RAW = "https://raw.githubusercontent.com/acme/rigs";

describe("fetchRoot", () => {
  it("takes every TOML file in the folder and below, keyed under the repository by its path from the folder", async () => {
    const { fetch } = fakeFetch({
      [API]: { json: { default_branch: "main" } },
      [`${API}/git/trees/main?recursive=1`]: {
        json: {
          truncated: false,
          tree: [
            { path: "data/rigs/a/rig.toml", type: "blob", size: 10 },
            { path: "data/rigs/b/rig.toml", type: "blob", size: 10 },
            { path: "data/README.md", type: "blob", size: 10 },
            { path: "data/rigs", type: "tree" },
            { path: "other/x.toml", type: "blob", size: 10 },
            { path: "data/big.toml", type: "blob", size: 2 * 1024 * 1024 },
          ],
        },
      },
      [`${RAW}/main/data/rigs/a/rig.toml`]: { text: "a" },
      [`${RAW}/main/data/rigs/b/rig.toml`]: { text: "b" },
    });

    const root = await fetchRoot({ owner: "acme", repo: "rigs", ref: null, path: "data" }, fetch);

    expect(root).toEqual({
      files: { "github/acme/rigs/rigs/a/rig.toml": "a", "github/acme/rigs/rigs/b/rig.toml": "b" },
      tooLong: ["data/big.toml"],
    });
  });

  it("reads the ref the address names without asking for the default branch", async () => {
    const { fetch, asked } = fakeFetch({
      [`${API}/git/trees/v1?recursive=1`]: { json: { truncated: false, tree: [{ path: "a.toml", type: "blob", size: 1 }] } },
      [`${RAW}/v1/a.toml`]: { text: "a" },
    });

    expect(await fetchRoot({ owner: "acme", repo: "rigs", ref: "v1", path: "" }, fetch)).toEqual({
      files: { "github/acme/rigs/a.toml": "a" },
      tooLong: [],
    });
    expect(asked).not.toContain(API);
  });

  it("refuses a repository GitHub does not show, a folder without TOML files or with too many", async () => {
    const tree = (count: number) => ({
      [`${API}/git/trees/main?recursive=1`]: {
        json: { truncated: false, tree: Array.from({ length: count }, (_, i) => ({ path: `${i}.toml`, type: "blob", size: 1 })) },
      },
    });
    const at = { owner: "acme", repo: "rigs", ref: "main", path: "" };

    expect(await fetchRoot(at, fakeFetch({}).fetch)).toEqual({ refused: expect.stringMatching(/no public repository/) });
    expect(await fetchRoot(at, fakeFetch(tree(0)).fetch)).toEqual({ refused: expect.stringMatching(/no TOML file/) });
    expect(await fetchRoot(at, fakeFetch(tree(MAX_ROOT_FILES + 1)).fetch)).toEqual({
      refused: expect.stringMatching(/more than 200/),
    });
  });

  it("refuses when GitHub says the page asked too often", async () => {
    const { fetch } = fakeFetch({ [API]: { status: 403, json: {}, headers: { "x-ratelimit-remaining": "0" } } });

    expect(await fetchRoot({ owner: "acme", repo: "rigs", ref: null, path: "" }, fetch)).toEqual({
      refused: expect.stringMatching(/too often/),
    });
  });
});
