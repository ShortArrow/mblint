import { expect, type Page, test } from "@playwright/test";

/** The text in the editor. */
async function editorText(page: Page): Promise<string> {
  return (await page.locator("#editor .cm-content").innerText()).replaceAll(" ", " ");
}

/** Creates a card, then a rig on the chosen board, which opens in the editor. */
async function cardAndRig(page: Page): Promise<void> {
  await page.locator(".new-menu > summary").click();
  await page.locator('[data-new="card"]').click();
  await page.locator('[data-new="rig"]').click();
  await expect(page.locator("#editor-path")).toHaveText("local/new-rig.toml");
}

/** Places the new card in the PCIe slot `PCIE1` by selecting it and then the socket. */
async function placeCard(page: Page): Promise<void> {
  await page.locator('[data-part="local/new-card.toml"]').click();
  await page.locator('[data-socket="PCIE1"]').click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#bracket .node").first()).toBeVisible();
});

test("placing a part writes it into the rig open in the editor, keeping a comment typed there", async ({ page }) => {
  await cardAndRig(page);
  await page.locator("#editor .cm-content").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\n# keep me");
  await page.waitForTimeout(400);

  await placeCard(page);

  await expect.poll(() => editorText(page)).toContain('PCIE1 = "local/new-card.toml"');
  expect(await editorText(page)).toContain("# keep me");
});

test("clearing the rig empties the bindings of the rig open in the editor", async ({ page }) => {
  await cardAndRig(page);
  await placeCard(page);
  await expect.poll(() => editorText(page)).toContain("PCIE1");

  await page.locator("#clear").click();

  await expect.poll(() => editorText(page)).not.toContain("PCIE1");
});

test("opening a rig in the editor applies it", async ({ page }) => {
  await cardAndRig(page);
  await placeCard(page);
  await expect.poll(() => editorText(page)).toContain("PCIE1");
  await page.locator("#editor-close").click();
  await page.locator("#clear").click();
  await expect(page.locator('[data-socket="PCIE1"]')).not.toContainText("New card");

  await page.locator('[data-edit="local/new-rig.toml"]').click();

  await expect(page.locator('[data-socket="PCIE1"]')).toContainText("New card");
});

test("an edit to the rig open in the editor applies it", async ({ page }) => {
  await cardAndRig(page);
  await page.locator("#editor .cm-content").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type('\nPCIE1 = "local/new-card.toml"');

  await expect(page.locator('[data-socket="PCIE1"]')).toContainText("New card");
});

test("dragging a part onto a socket writes it into the rig open in the editor", async ({ page }) => {
  await cardAndRig(page);

  await page.locator('[data-part="local/new-card.toml"]').dragTo(page.locator('[data-socket="PCIE1"]'));

  await expect.poll(() => editorText(page)).toContain('PCIE1 = "local/new-card.toml"');
});
