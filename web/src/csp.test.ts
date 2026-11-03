import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const web = join(import.meta.dirname, "..");

function policy(): Map<string, string[]> {
  const headers = readFileSync(join(web, "public/_headers"), "utf8");
  const line = headers.split("\n").find((l) => l.trim().startsWith("Content-Security-Policy:"));
  const value = line!.slice(line!.indexOf(":") + 1);
  return new Map(
    value
      .split(";")
      .map((d) => d.trim().split(/\s+/))
      .filter((d) => d[0])
      .map(([name, ...sources]) => [name!, sources]),
  );
}

describe("the Content Security Policy", () => {
  it("runs scripts and Wasm only from the page's origin", () => {
    expect(policy().get("script-src")).toEqual(["'self'", "'wasm-unsafe-eval'"]);
  });

  it("fetches only from the page, GitHub's API and its host of raw files", () => {
    expect(policy().get("connect-src")).toEqual(["'self'", "https://api.github.com", "https://raw.githubusercontent.com"]);
  });

  it("takes fonts only from Google Fonts and lets no site frame the page", () => {
    expect(policy().get("font-src")).toEqual(["https://fonts.gstatic.com"]);
    expect(policy().get("frame-ancestors")).toEqual(["'none'"]);
    expect(policy().get("object-src")).toEqual(["'none'"]);
  });

  it("is met by index.html, which holds no inline script", () => {
    const html = readFileSync(join(web, "index.html"), "utf8");
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];

    expect(scripts.length).toBeGreaterThan(0);
    for (const [, attributes, body] of scripts) {
      expect(attributes).toMatch(/\bsrc=/);
      expect(body!.trim()).toBe("");
    }
  });
});
