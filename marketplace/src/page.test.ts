// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { HOUR } from "./answer";
import { renderPage } from "./page";

const NOW = Date.UTC(2026, 10, 13, 12);

/** The page for the repositories `names`, each with a description, taken `age` before `NOW`. */
function pageOf(names: string[], text = "", age = 0): Document {
  const found = names.map((name, i) => ({
    full_name: name,
    description: `About ${name}`,
    stargazers_count: names.length - i,
    pushed_at: "2026-11-01T09:00:00Z",
    html_url: `https://github.com/${name}`,
  }));
  const html = renderPage({ kind: "answer", at: NOW - age, found }, [], text, NOW);
  return new DOMParser().parseFromString(html, "text/html");
}

describe("renderPage", () => {
  it("shows each repository with a link to it on GitHub and a link opening it in the simulator", () => {
    const entry = pageOf(["acme/rigs"]).querySelector("li")!;
    expect(entry.querySelector('a[href="https://github.com/acme/rigs"]')!.textContent).toBe("acme/rigs");
    expect(entry.querySelector('a[href="https://mblint.shortarrow.jp/?github=acme/rigs"]')).not.toBeNull();
    expect(entry.textContent).toContain("About acme/rigs");
    expect(entry.textContent).toContain("2026-11-01");
  });

  it("shows only the repositories the text narrows to, and keeps the text in the field", () => {
    const page = pageOf(["acme/rigs", "zeta/boards"], "zeta");
    expect([...page.querySelectorAll("li a:first-child")].map((link) => link.textContent)).toEqual(["zeta/boards"]);
    expect(page.querySelector<HTMLInputElement>('input[name="q"]')!.value).toBe("zeta");
  });

  it("says how old the answer is when it is an hour old or older", () => {
    expect(pageOf(["acme/rigs"], "", 3 * HOUR).body.textContent).toContain("3 hours ago");
    expect(pageOf(["acme/rigs"], "", HOUR - 1).body.textContent).not.toContain("ago");
  });

  it("shows text from GitHub as text, never as HTML", () => {
    const html = renderPage(
      {
        kind: "answer",
        at: NOW,
        found: [{ full_name: "a/b", description: "<img src=x>", stargazers_count: 0, pushed_at: "", html_url: "https://github.com/a/b" }],
      },
      [],
      '"><script>',
      NOW,
    );
    const page = new DOMParser().parseFromString(html, "text/html");
    expect(page.querySelector("img")).toBeNull();
    expect(page.querySelector("script")).toBeNull();
  });

  it("says the marketplace is busy and to try again later", () => {
    expect(renderPage({ kind: "busy" }, [], "", NOW)).toContain("busy");
  });

  it("says GitHub cannot be reached and to try again later", () => {
    expect(renderPage({ kind: "unreachable" }, [], "", NOW)).toContain("GitHub cannot be reached");
  });
});
