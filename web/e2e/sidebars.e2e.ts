import { expect, type Page, test } from "@playwright/test";

/** The gaps between the bracket and the sidebar on each side of it, in CSS pixels. */
async function gaps(page: Page): Promise<{ left: number; right: number }> {
  return page.evaluate(() => {
    const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const [left, stage, right] = [box(".picker"), box(".panel.stage"), box(".report-panel")];
    return { left: stage.left - left.right, right: right.left - stage.right };
  });
}

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

test("the bracket lies 8 pixels from each sidebar, open or collapsed", async ({ page }) => {
  expect(await gaps(page)).toEqual({ left: 8, right: 8 });
  await toggle(page, ".picker");
  expect(await gaps(page)).toEqual({ left: 8, right: 8 });
  await toggle(page, ".picker");
  await toggle(page, ".report-panel");
  expect(await gaps(page)).toEqual({ left: 8, right: 8 });
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

for (const side of [".picker", ".report-panel"] as const) {
  test(`a collapsed ${side} shows its icons until it has opened and its contents until it has collapsed`, async ({ page }) => {
    await toggle(page, side);
    await page.evaluate((side) => {
      const sidebar = document.querySelector<HTMLElement>(side)!;
      const shown = (part: string) => {
        const style = getComputedStyle(sidebar.querySelector(part)!);
        return style.display !== "none" && style.visibility === "visible";
      };
      const state = window as unknown as { phase: string; faults: string[]; sampling: number };
      state.faults = [];
      const sample = () => {
        const width = sidebar.getBoundingClientRect().width;
        if (width > 41 && width < 200) {
          const expected = state.phase === "opening" ? ".rail" : ".full";
          const other = expected === ".rail" ? ".full" : ".rail";
          if (!shown(expected) || shown(other)) state.faults.push(`${state.phase} at width ${width}`);
        }
        state.sampling = requestAnimationFrame(sample);
      };
      sample();
    }, side);
    const setPhase = (phase: string) => page.evaluate((phase) => ((window as unknown as { phase: string }).phase = phase), phase);
    const box = (await page.locator(side).boundingBox())!;

    await setPhase("opening");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);
    await setPhase("collapsing");
    await page.mouse.move(720, 450);
    await page.waitForTimeout(500);

    const faults = await page.evaluate(() => {
      const state = window as unknown as { faults: string[]; sampling: number };
      cancelAnimationFrame(state.sampling);
      return state.faults;
    });
    expect(faults).toEqual([]);
  });
}

for (const side of [".picker", ".report-panel"] as const) {
  test(`a ${side} collapsed by its control stays collapsed under the pointer until the pointer leaves it`, async ({ page }) => {
    const width = async () => (await page.locator(side).boundingBox())!.width;

    await page.locator(`${side} > .foot`).click();
    await page.waitForTimeout(500);
    expect(await width()).toBe(40);

    await page.mouse.move(720, 450);
    const box = (await page.locator(side).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(width).toBeGreaterThan(200);
  });
}
