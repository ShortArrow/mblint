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
    "Make a public repository on GitHub, for example from the template ShortArrow/mblint-rigs.",
    "Put the files of a rig exported from the simulator at the root of its default branch.",
    "Add the topic mblint-rig to the repository.",
    "Wait up to an hour for the marketplace to list it.",
  ]);
  await expect(dialog.locator('a[href="https://marketplace.mblint.shortarrow.jp/"]')).toBeVisible();
  await expect(dialog.locator('ol > li:first-child a[href="https://github.com/ShortArrow/mblint-rigs"]')).toHaveText("ShortArrow/mblint-rigs");
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

test("loading two rigs at once offers the steps once", async ({ page }) => {
  await page.locator("#file").setInputFiles([
    { name: "desk.toml", mimeType: "application/toml", buffer: Buffer.from(RIG) },
    { name: "tower.toml", mimeType: "application/toml", buffer: Buffer.from(RIG.replace("Desk", "Tower")) },
  ]);
  await expect(page.locator("#notices [data-publish]")).toHaveCount(1);
});

test("creating a new rig offers no steps", async ({ page }) => {
  await page.locator('[data-new="rig"]').click();
  await expect(page.locator("#editor-path")).toHaveText("local/new-rig.toml");
  await expect(page.locator("#notices [data-publish]")).toHaveCount(0);
});

test("the offer is drawn as a notice in the accent colour, and the dialog's steps as a numbered list", async ({ page }) => {
  await load(page, "desk.toml", RIG);
  const accent = await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement("div"));
    probe.style.color = "var(--accent)";
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
  await expect(page.locator("#notices .notice.offer")).toHaveCSS("border-top-color", accent);
  await page.locator("#notices [data-publish]").click();
  await expect(page.locator("dialog#publish .steps")).toHaveCSS("padding-left", "16px");
  await expect(page.locator("dialog#publish ol > li").first()).toHaveCSS("list-style-type", "decimal");
});

/** Exports the rig being built, waiting for the archive's download. */
async function exportRig(page: Page): Promise<void> {
  const download = page.waitForEvent("download");
  await page.locator("#export").click();
  await download;
}

test("exporting the rig offers the steps for publishing it", async ({ page }) => {
  await exportRig(page);
  await page.locator("#notices [data-publish]").click();
  await expect(page.locator("dialog#publish")).toBeVisible();
});

test("exporting again, or after loading a rig, still offers the steps once", async ({ page }) => {
  await load(page, "desk.toml", RIG);
  await exportRig(page);
  await exportRig(page);
  await expect(page.locator("#notices [data-publish]")).toHaveCount(1);
});
