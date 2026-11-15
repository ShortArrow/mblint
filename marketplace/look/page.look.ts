import { type Page, expect, test } from "@playwright/test";
import { renderPage } from "../src/page";

const NOW = Date.UTC(2026, 10, 13, 12);

/** A repository named `name` described by `description`, as GitHub's search returns it. */
function found(name: string, description: string) {
  return { full_name: name, description, stargazers_count: 1, pushed_at: "2026-11-01T09:00:00Z", html_url: `https://github.com/${name}` };
}

/** Opens the page listing `repositories`, recording the hosts it asks for and answering none of them. */
async function open(page: Page, repositories = [found("acme/rigs", "A rig"), found("zeta/boards", "Boards")]): Promise<string[]> {
  const hosts: string[] = [];
  await page.route("**/*", (route) => {
    hosts.push(new URL(route.request().url()).host);
    return route.abort();
  });
  await page.setContent(renderPage({ kind: "answer", at: NOW, found: repositories }, [], "", NOW));
  return hosts;
}

test("follows the system's light theme in the simulator's colours", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await open(page);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator("body")).toHaveCSS("color", "rgb(20, 23, 28)");
});

test("follows the system's dark theme in the simulator's colours", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(21, 26, 33)");
  await expect(page.locator("body")).toHaveCSS("color", "rgb(232, 236, 241)");
});

test("uses the simulator's typefaces", async ({ page }) => {
  await open(page);
  await expect(page.locator("body")).toHaveCSS("font-family", /^Inter,/);
  await expect(page.locator("code").first()).toHaveCSS("font-family", /^"JetBrains Mono",/);
});

test("has a header like the simulator's, naming the marketplace", async ({ page }) => {
  await open(page);
  const header = page.locator("header");
  await expect(header.locator("h1")).toHaveText(/mblint\s*marketplace/);
  await expect(header).toHaveCSS("height", "56px");
  await expect(header).toHaveCSS("position", "sticky");
});

test("shows each repository as a card, side by side on a wide screen", async ({ page }) => {
  await open(page);
  const cards = page.locator("li");
  await expect(cards.first()).toHaveCSS("border-top-width", "1px");
  await expect(cards.first()).toHaveCSS("border-top-left-radius", "8px");
  await expect(cards.first()).toHaveCSS("list-style-type", "none");
  const [a, b] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
  expect(a!.y).toBeCloseTo(b!.y, 0);
  expect(b!.x).toBeGreaterThan(a!.x + a!.width);
});

test("does not scroll sideways on a narrow screen, however long a name or description", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page, [found(`acme/${"r".repeat(200)}`, "d".repeat(500))]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});

test("loads nothing but Google Fonts", async ({ page }) => {
  const hosts = await open(page);
  expect(hosts.filter((host) => host !== "fonts.googleapis.com" && host !== "fonts.gstatic.com")).toEqual([]);
  expect(hosts).toContain("fonts.googleapis.com");
});
