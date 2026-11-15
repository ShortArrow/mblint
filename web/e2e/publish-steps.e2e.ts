import { expect, type Page, test } from "@playwright/test";

const TAICHI = "boards/asrock/x870_taichi_creator.toml";

/** Loads a file named `name` holding `contents` through the control that loads files. */
async function load(page: Page, name: string, contents: string): Promise<void> {
  await page.locator("#file").setInputFiles({ name, mimeType: "application/toml", buffer: Buffer.from(contents) });
}

const RIG = `schema_version = "2.0.0"\nname = "Desk"\nboard = "${TAICHI}"\n\n[bindings]\n`;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#bracket .node").first()).toBeVisible();
});

test("loading a rig offers the steps for publishing it, which a dialog lists with a link to the marketplace", async ({ page }) => {
  await load(page, "desk.toml", RIG);
  await page.locator("#notices [data-publish]").click();

  const dialog = page.locator("dialog#publish");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("h2")).toHaveText("Publish your rig");
  await expect(dialog.locator("ol > li")).toHaveText([
    "Make a public repository on GitHub.",
    "Put the files of a rig exported from the simulator at the root of its default branch.",
    "Add the topic mblint-rig to the repository.",
    "Wait up to an hour for the marketplace to list it.",
  ]);
  await expect(dialog.locator('a[href="https://marketplace.mblint.shortarrow.jp/"]')).toBeVisible();
});

test("loading a file that is not a rig offers no steps", async ({ page }) => {
  await load(page, "broken.toml", "not = [toml");
  await expect(page.locator("#notices .notice")).toHaveCount(1);
  await expect(page.locator("#notices [data-publish]")).toHaveCount(0);
});

test("the offer goes when the other notices go", async ({ page }) => {
  await load(page, "desk.toml", RIG);
  await expect(page.locator("#notices [data-publish]")).toBeVisible();
  await page.locator('[data-board]:not(.selected)').first().click();
  await expect(page.locator("#notices [data-publish]")).toHaveCount(0);
});
