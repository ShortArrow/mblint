import { expect, test } from "@playwright/test";

test("the header links to the marketplace between exporting the rig and switching the theme", async ({ page }) => {
  await page.goto("/");
  const link = page.locator("header a#marketplace");

  await expect(link).toHaveAttribute("href", "https://marketplace.mblint.shortarrow.jp/");
  await expect(link).toHaveAttribute("title", /marketplace/i);
  const order = await page.locator("header .tool").evaluateAll((tools) => tools.map((tool) => tool.id));
  expect(order.slice(order.indexOf("export"), order.indexOf("export") + 3)).toEqual(["export", "marketplace", "theme"]);
});

test("the marketplace link looks like the other controls of the header", async ({ page }) => {
  await page.goto("/");
  const link = await page.locator("#marketplace").boundingBox();
  const exporting = await page.locator("#export").boundingBox();

  expect(link!.width).toBeCloseTo(exporting!.width, 0);
  expect(link!.height).toBeCloseTo(exporting!.height, 0);
  expect(link!.y).toBeCloseTo(exporting!.y, 0);
  await expect(page.locator("#marketplace")).toHaveCSS("text-decoration-line", "none");
  await expect(page.locator("#marketplace")).toHaveCSS("color", await page.locator("#export").evaluate((e) => getComputedStyle(e).color));
});
