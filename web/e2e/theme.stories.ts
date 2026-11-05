import { expect, test } from "@playwright/test";

test.use({ colorScheme: "dark" });

test("a story is drawn in the system's theme until the toolbar picks one", async ({ page }) => {
  await page.goto("/iframe.html?id=bracket--empty-card&viewMode=story");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("a theme picked in the toolbar overrides the system's", async ({ page }) => {
  await page.goto("/iframe.html?id=bracket--empty-card&viewMode=story&globals=theme:light");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("Storybook's own frame is drawn in the system's theme", async ({ page }) => {
  await page.goto("/?path=/story/bracket--empty-card");
  const sidebar = page.locator(".sidebar-container");
  await expect(sidebar).toBeVisible();

  const [r, g, b] = (await sidebar.evaluate((element) => getComputedStyle(element).backgroundColor))
    .match(/\d+/g)!
    .map(Number);
  expect(r + g + b).toBeLessThan(3 * 96);
});
