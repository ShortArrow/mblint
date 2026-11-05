import { expect, test } from "@playwright/test";

test("the page names an SVG icon for its tab, served from its own origin", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(href).not.toBeNull();
  const url = new URL(href!, page.url());
  expect(url.origin).toBe(new URL(page.url()).origin);

  const response = await request.get(url.href);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
  expect(await response.text()).toContain("<svg");
});
