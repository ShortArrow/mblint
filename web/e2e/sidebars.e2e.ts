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

type Frame = { width: number; icons: number[]; lists: number[] };

/** Records, every frame until `stopFrames` is called, the width of `side`, the left edges of its heading icons and the heights of its lists. */
async function recordFrames(page: Page, side: string): Promise<void> {
  await page.evaluate((side) => {
    const sidebar = document.querySelector<HTMLElement>(side)!;
    const state = window as unknown as { frames: Frame[]; sampling: number };
    state.frames = [];
    const sample = () => {
      state.frames.push({
        width: sidebar.getBoundingClientRect().width,
        icons: [...sidebar.querySelectorAll(".heading-icon")].map((icon) => Math.round(icon.getBoundingClientRect().left)),
        lists: [...sidebar.querySelectorAll(".full > :not(h2)")].map((list) => list.getBoundingClientRect().height),
      });
      state.sampling = requestAnimationFrame(sample);
    };
    sample();
  }, side);
}

/** Stops `recordFrames` and returns the frames it recorded. */
async function stopFrames(page: Page): Promise<Frame[]> {
  return page.evaluate(() => {
    const state = window as unknown as { frames: Frame[]; sampling: number };
    cancelAnimationFrame(state.sampling);
    return state.frames;
  });
}

/** Rests the pointer on `side` until it has opened, then moves it off until `side` has collapsed. */
async function peek(page: Page, side: string): Promise<void> {
  const box = (await page.locator(side).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(600);
  await page.mouse.move(720, 450);
  await page.waitForTimeout(600);
}

for (const side of [".picker", ".report-panel"] as const) {
  test(`the heading icons of a collapsed ${side} stay where they are while it opens and collapses`, async ({ page }) => {
    await toggle(page, side);
    await recordFrames(page, side);

    await peek(page, side);

    const frames = await stopFrames(page);
    expect(frames[0].icons.length).toBeGreaterThan(1);
    expect(new Set(frames.map((frame) => frame.icons.join()))).toEqual(new Set([frames[0].icons.join()]));
  });

  test(`a collapsed ${side} opens its lists only once it has widened, and closes them before it narrows`, async ({ page }) => {
    await toggle(page, side);
    await recordFrames(page, side);

    await peek(page, side);

    const frames = await stopFrames(page);
    const open = Math.max(...frames.map((frame) => frame.width));
    expect(open).toBeGreaterThan(200);
    expect(frames.some((frame) => frame.lists.some((height) => height > 20))).toBe(true);
    const narrower = frames.filter((frame) => frame.width < open - 0.5);
    expect(narrower.filter((frame) => frame.lists.some((height) => height > 0.5))).toEqual([]);
  });

  test(`a collapsed ${side} draws no line between its icons`, async ({ page }) => {
    await toggle(page, side);

    const lines = await page.locator(`${side} > .full > h2`).evaluateAll((headings) =>
      headings.flatMap((heading) => {
        const style = getComputedStyle(heading);
        return [
          [style.borderTopWidth, style.borderTopColor],
          [style.borderBottomWidth, style.borderBottomColor],
        ].filter(([width, color]) => width !== "0px" && !color.endsWith(", 0)") && color !== "transparent");
      }),
    );

    expect(lines).toEqual([]);
  });

  test(`an icon of a collapsed ${side} opens it`, async ({ page }) => {
    await toggle(page, side);

    await page.locator(`${side} .heading-icon`).first().click();
    await page.mouse.move(720, 450);

    await expect.poll(async () => (await page.locator(side).boundingBox())!.width).toBeGreaterThan(200);
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
