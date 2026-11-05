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

type Frame = { width: number; icons: number[]; lists: number[]; footGap: number };

/**
 * Records, every frame until `stopFrames` is called, the width of `side`, the left edges of its heading icons, the heights
 * of its lists and the gap between its last drawn inset and the control below.
 */
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
        footGap:
          sidebar.querySelector(":scope > .foot")!.getBoundingClientRect().top -
          Math.max(
            ...[...sidebar.querySelectorAll(":scope > .full > *")]
              .map((inset) => inset.getBoundingClientRect())
              .filter((box) => box.height > 0)
              .map((box) => box.bottom),
          ),
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

  test(`a collapsed ${side} keeps its control 8 pixels below its insets while it opens and collapses`, async ({ page }) => {
    await toggle(page, side);
    await recordFrames(page, side);

    await peek(page, side);

    const gaps = (await stopFrames(page)).map((frame) => Math.round(frame.footGap));
    expect(gaps.filter((gap) => gap !== 8)).toEqual([]);
  });

  test(`a collapsed ${side} whose lists were resized keeps its control 8 pixels below its insets while it opens and collapses`, async ({ page }) => {
    const box = (await page.locator(`${side} .splitter`).first().boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40);
    await page.mouse.up();
    await expect(page.locator(side)).toHaveClass(/sized/);
    await toggle(page, side);
    await recordFrames(page, side);

    await peek(page, side);

    const gaps = (await stopFrames(page)).map((frame) => Math.round(frame.footGap));
    expect(gaps.filter((gap) => gap !== 8)).toEqual([]);
  });

  test(`each list of an open ${side} lies in its own rounded inset, 8 pixels from the next and from the wide control below`, async ({ page }) => {
    const layout = await page.locator(side).evaluate((sidebar) => {
      const box = (element: Element) => element.getBoundingClientRect();
      const headings = [...sidebar.querySelectorAll(":scope > .full > h2")];
      const foot = sidebar.querySelector(":scope > .foot")!;
      const last = headings.at(-1)!.nextElementSibling!;
      return {
        gaps: headings.slice(1).map((heading) => Math.round(box(heading).top - box(heading.previousElementSibling!).bottom)),
        corners: headings.map((heading) => [
          getComputedStyle(heading).borderTopLeftRadius,
          getComputedStyle(heading.nextElementSibling!).borderBottomRightRadius,
        ]),
        footGap: Math.round(box(foot).top - box(last).bottom),
        footWidth: Math.round(box(foot).width) - Math.round(box(headings[0]).width),
      };
    });

    expect(layout.gaps.every((gap) => gap === 8)).toBe(true);
    expect(layout.corners.flat().every((radius) => radius === "8px")).toBe(true);
    expect(layout.footGap).toBe(8);
    expect(layout.footWidth).toBe(0);
  });

  test(`a collapsed ${side} shrinks each inset to its icon and stretches the control over the height they leave`, async ({ page }) => {
    await toggle(page, side);

    const layout = await page.locator(side).evaluate((sidebar) => {
      const box = (element: Element) => element.getBoundingClientRect();
      const headings = [...sidebar.querySelectorAll(":scope > .full > h2")];
      const foot = sidebar.querySelector(":scope > .foot")!;
      return {
        sizes: headings.map((heading) => [Math.round(box(heading).width), Math.round(box(heading).height)]),
        gaps: headings.slice(1).map((heading, index) => Math.round(box(heading).top - box(headings[index]).bottom)),
        footGap: Math.round(box(foot).top - box(headings.at(-1)!).bottom),
        footEnd: Math.round(box(sidebar).bottom - box(foot).bottom),
      };
    });

    expect(layout.sizes.every(([width, height]) => width === 40 && height === 40)).toBe(true);
    expect(layout.gaps.every((gap) => gap === 8)).toBe(true);
    expect(layout.footGap).toBe(8);
    expect(layout.footEnd).toBe(0);
  });

  test(`the bracket shows through the gaps of a ${side} opened by the pointer`, async ({ page }) => {
    await toggle(page, side);
    const box = (await page.locator(side).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 20);
    await page.waitForTimeout(600);

    const drawn = await page.locator(side).evaluate((sidebar) => {
      const style = getComputedStyle(sidebar);
      return { width: sidebar.getBoundingClientRect().width, image: style.backgroundImage, shadow: style.boxShadow };
    });

    expect(drawn.width).toBeGreaterThan(200);
    expect(drawn.image).toMatch(side === ".picker" ? /^linear-gradient\(to right, .+ 48px, rgba\(0, 0, 0, 0\)\)$/ : /^linear-gradient\(to left, .+ 48px, rgba\(0, 0, 0, 0\)\)$/);
    expect(drawn.shadow).toBe("none");
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
