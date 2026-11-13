import { describe, expect, it } from "vitest";
import { type Listing, listRepositories, narrow } from "./listing";

/** A repository as GitHub's search API returns it, with the fields the listing reads. */
function found(fullName: string, stars: number, description: string | null = null) {
  return {
    full_name: fullName,
    description,
    stargazers_count: stars,
    pushed_at: "2026-11-01T09:00:00Z",
    html_url: `https://github.com/${fullName}`,
  };
}

describe("listRepositories", () => {
  it("shows each repository with its name, description, stars, last push and the simulator's address for it", () => {
    expect(listRepositories([found("acme/rigs", 3, "Home lab")], [])).toEqual([
      {
        name: "acme/rigs",
        description: "Home lab",
        stars: 3,
        pushedAt: "2026-11-01T09:00:00Z",
        repository: "https://github.com/acme/rigs",
        open: "https://mblint.shortarrow.jp/?github=acme/rigs",
      },
    ]);
  });

  it("orders the repositories by their stars, most first", () => {
    const listed = listRepositories([found("a/one", 1), found("b/three", 3), found("c/two", 2)], []);
    expect(listed.map((entry) => entry.name)).toEqual(["b/three", "c/two", "a/one"]);
  });

  it("leaves out the repositories the excluded list names, ignoring case", () => {
    const listed = listRepositories([found("spam/rigs", 9), found("acme/rigs", 1)], ["Spam/Rigs"]);
    expect(listed.map((entry) => entry.name)).toEqual(["acme/rigs"]);
  });

  it("shows a repository without a description with an empty one", () => {
    expect(listRepositories([found("acme/rigs", 0)], [])[0]!.description).toBe("");
  });
});

describe("narrow", () => {
  const listed: Listing[] = listRepositories(
    [found("acme/rigs", 2, "Home LAB"), found("zeta/boards", 1, "Workstation")],
    [],
  );

  it("keeps the repositories whose name contains the text, ignoring case", () => {
    expect(narrow(listed, "ZETA").map((entry) => entry.name)).toEqual(["zeta/boards"]);
  });

  it("keeps the repositories whose description contains the text, ignoring case", () => {
    expect(narrow(listed, "lab").map((entry) => entry.name)).toEqual(["acme/rigs"]);
  });

  it("keeps every repository for empty text", () => {
    expect(narrow(listed, "")).toEqual(listed);
  });
});
