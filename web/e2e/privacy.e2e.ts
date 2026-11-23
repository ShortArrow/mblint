import { expect, test } from "@playwright/test";

test("the settings link to the privacy page", async ({ page }) => {
  await page.goto("/");
  await page.locator("#settings-open").click();
  const link = page.locator("dialog#settings a", { hasText: "Privacy" });

  await expect(link).toHaveAttribute("href", "/privacy");
});

test("the privacy page says what Cloudflare Web Analytics reports, citing Cloudflare, and holds no script", async ({ page }) => {
  await page.goto("/privacy.html");

  await expect(page.locator("h1")).toHaveText("Privacy");
  await expect(page.locator("main")).toContainText("Cloudflare Web Analytics");
  await expect(page.locator("main")).toContainText("cookie");
  await expect(page.locator('a[href="https://www.cloudflare.com/web-analytics/"]')).toHaveCount(1);
  await expect(page.locator('a[href="https://developers.cloudflare.com/web-analytics/data-metrics/dimensions/"]')).toHaveCount(1);
  await expect(page.locator("main")).toContainText("fonts.googleapis.com");
  await expect(page.locator("main")).toContainText("api.github.com");
  await expect(page.locator("main")).toContainText("cf_clearance");
  await expect(page.locator('a[href="https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/"]')).toHaveCount(1);
  await expect(page.locator("script")).toHaveCount(0);
});

test("the privacy page does not scroll sideways on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/privacy.html");

  const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(scroll).toBeLessThanOrEqual(client);
});
