import { expect, type Page, test } from "@playwright/test";

const TAICHI = "boards/asrock/x870_taichi_creator.toml";
const STEEL = "boards/asrock/z890_steel_legend_wifi.toml";
const RIGS = { "rigs/a.toml": rig("a", TAICHI), "rigs/b.toml": rig("b", STEEL) };

/** A rig named `name` on the carried board at `board`, with nothing installed. */
function rig(name: string, board: string): string {
  return `schema_version = "2.0.0"\nname = "${name}"\nboard = "${board}"\n\n[bindings]\n`;
}

/** Answers the page's questions to GitHub as the public repository `acme/rigs`, holding `RIGS` on `main`. */
async function serveRepository(page: Page): Promise<void> {
  await page.route("https://api.github.com/repos/acme/rigs", (route) => route.fulfill({ json: { default_branch: "main" } }));
  await page.route("https://api.github.com/repos/acme/rigs/git/trees/main?recursive=1", (route) =>
    route.fulfill({
      json: { truncated: false, tree: Object.entries(RIGS).map(([path, text]) => ({ path, type: "blob", size: text.length })) },
    }),
  );
  for (const [path, text] of Object.entries(RIGS)) {
    await page.route(`https://raw.githubusercontent.com/acme/rigs/main/${path}`, (route) => route.fulfill({ body: text }));
  }
}

/** The query of the page's address, decoded. */
function query(page: Page): Record<string, string> {
  return Object.fromEntries(new URL(page.url()).searchParams);
}

test.beforeEach(async ({ page }) => {
  await serveRepository(page);
});

test("an address naming a folder and one of its rigs loads the folder and applies that rig", async ({ page }) => {
  await page.goto("/?github=acme/rigs&rig=rigs/b.toml");

  await expect(page.locator('[data-rig="github/acme/rigs/rigs/b.toml"]')).toHaveClass(/selected/);
  await expect(page.locator(`[data-board="${STEEL}"]`)).toHaveClass(/selected/);
  await expect(page.locator('[data-rig="github/acme/rigs/rigs/a.toml"]')).not.toHaveClass(/selected/);
});

test("an address naming no rig of the folder reports the path and applies no rig", async ({ page }) => {
  await page.goto("/");
  const opened = await page.locator("[data-board].selected").getAttribute("data-board");

  await page.goto("/?github=acme/rigs&rig=rigs/c.toml");

  await expect(page.locator("#notices")).toContainText("rigs/c.toml");
  await expect(page.locator('[data-rig="github/acme/rigs/rigs/a.toml"]')).toBeVisible();
  await expect(page.locator("[data-board].selected")).toHaveAttribute("data-board", opened!);
});

test("loading a folder by the control names it in the page's address without a new history entry", async ({ page }) => {
  await page.goto("/");
  const entries = await page.evaluate(() => history.length);

  await page.locator("#github-open").click();
  await page.locator("#github-address").fill("https://github.com/acme/rigs");
  await page.locator("#github-load").click();
  await expect(page.locator('[data-rig="github/acme/rigs/rigs/a.toml"]')).toBeVisible();

  expect(query(page)).toEqual({ github: "acme/rigs" });
  expect(await page.evaluate(() => history.length)).toBe(entries);
});

test("applying a rig of the folder adds it to the address, and choosing another board removes it", async ({ page }) => {
  await page.goto("/?github=acme/rigs");
  await page.locator('[data-rig="github/acme/rigs/rigs/a.toml"]').click();
  await expect.poll(() => query(page)).toEqual({ github: "acme/rigs", rig: "rigs/a.toml" });

  await page.locator(`[data-board="${STEEL}"]`).click();

  await expect.poll(() => query(page)).toEqual({ github: "acme/rigs" });
});

test("applying a rig from elsewhere removes the folder's rig from the address", async ({ page }) => {
  await page.goto("/?github=acme/rigs");
  await page.locator('[data-rig="github/acme/rigs/rigs/a.toml"]').click();
  await expect.poll(() => query(page)).toEqual({ github: "acme/rigs", rig: "rigs/a.toml" });

  await page.locator('[data-new="rig"]').click();
  await page.locator("#editor-close").click();
  await page.locator('[data-rig="local/new-rig.toml"]').click();

  await expect.poll(() => query(page)).toEqual({ github: "acme/rigs" });
});
