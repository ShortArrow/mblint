import { expect, type Page, test } from "@playwright/test";

/** Clicks the control at the foot of the sidebar `side`, moves the pointer off it and waits for its width to settle. */
async function toggle(page: Page, side: ".picker" | ".report-panel"): Promise<void> {
  await page.locator(`${side} > .foot`).click();
  await page.mouse.move(720, 450);
  await page.waitForTimeout(400);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#bracket .node").first()).toBeVisible();
});

for (const side of [".picker", ".report-panel"] as const) {
  test(`a collapsed ${side} stays above the bracket and within its width while it opens and collapses`, async ({ page }) => {
    await toggle(page, side);
    await page.evaluate((side) => {
      const sidebar = document.querySelector(side)!;
      const full = sidebar.querySelector(".full")!;
      const faults: string[] = [];
      const sample = () => {
        const box = sidebar.getBoundingClientRect();
        if (box.width > 41) {
          const x = side === ".picker" ? box.right - 4 : box.left + 4;
          const top = document.elementFromPoint(x, box.top + box.height / 2);
          if (!sidebar.contains(top)) faults.push(`under ${top?.className} at width ${box.width}`);
          if (full.scrollWidth > full.clientWidth) faults.push(`overflowing at width ${box.width}`);
        }
        (window as unknown as { sampling: number }).sampling = requestAnimationFrame(sample);
      };
      (window as unknown as { faults: string[] }).faults = faults;
      sample();
    }, side);
    const box = (await page.locator(side).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);
    await page.mouse.move(720, 450);
    await page.waitForTimeout(500);

    const faults = await page.evaluate(() => {
      cancelAnimationFrame((window as unknown as { sampling: number }).sampling);
      return (window as unknown as { faults: string[] }).faults;
    });
    expect(faults).toEqual([]);
  });
}
