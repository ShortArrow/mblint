import { expect, test } from "@playwright/test";

test("the Storybook's privacy page says what Cloudflare Web Analytics reports and what Storybook keeps, and holds no script", async ({ page }) => {
  await page.goto("/privacy.html");

  await expect(page.locator("h1")).toHaveText("Privacy");
  await expect(page.locator("main")).toContainText("storybook.mblint.shortarrow.jp");
  await expect(page.locator("main")).toContainText("Cloudflare Web Analytics");
  await expect(page.locator('a[href="https://www.cloudflare.com/web-analytics/"]')).toHaveCount(1);
  await expect(page.locator('a[href="https://developers.cloudflare.com/web-analytics/data-metrics/dimensions/"]')).toHaveCount(1);
  await expect(page.locator("main")).toContainText("local storage");
  await expect(page.locator("main")).toContainText("cf_clearance");
  await expect(page.locator('a[href="https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/"]')).toHaveCount(1);
  await expect(page.locator("script")).toHaveCount(0);
});

test("the Storybook's privacy page does not scroll sideways on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/privacy.html");

  await expect(page.locator("h1")).toHaveText("Privacy");
  const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(scroll).toBeLessThanOrEqual(client);
});
