import { expect, type Page, test } from "@playwright/test";

const SIDES = { ".picker": ["#boards", "#parts", "#rigs"], ".report-panel": ["#report", "#links"] } as const;
type Side = keyof typeof SIDES;

/** The heights inside the border and padding of the lists of `side`, in CSS pixels. */
async function heights(page: Page, side: Side): Promise<number[]> {
  return page.evaluate(
    (lists) =>
      lists.map((selector) => {
        const list = document.querySelector(selector)!;
        const style = getComputedStyle(list);
        const edges = ["borderTopWidth", "borderBottomWidth", "paddingTop", "paddingBottom"] as const;
        return Math.round(edges.reduce((height, edge) => height - parseFloat(style[edge]), list.getBoundingClientRect().height));
      }),
    [...SIDES[side]],
  );
}

/** Drags the border above the heading of list `index` of `side` down by `delta` pixels. */
async function drag(page: Page, side: Side, index: number, delta: number): Promise<void> {
  const box = (await page.locator(`${side} .splitter`).nth(index - 1).boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + delta / 2);
  await page.mouse.move(x, y + delta);
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#bracket .node").first()).toBeVisible();
});

for (const side of Object.keys(SIDES) as Side[]) {
  test(`dragging a border of ${side} moves height between the lists above and below it`, async ({ page }) => {
    const before = await heights(page, side);

    await drag(page, side, 1, -40);

    const after = await heights(page, side);
    expect(after[0]).toBeCloseTo(before[0] - 40, -1);
    expect(after[1]).toBeCloseTo(before[1] + 40, -1);
    expect(after.slice(2)).toEqual(before.slice(2));
  });

  test(`dragging a border of ${side} makes no list shorter than 80 pixels`, async ({ page }) => {
    await drag(page, side, 1, -2000);

    expect((await heights(page, side))[0]).toBe(80);
  });

  test(`the browser remembers the heights of the lists of ${side}`, async ({ page }) => {
    await drag(page, side, 1, -40);
    const dragged = await heights(page, side);

    await page.reload();

    expect(await heights(page, side)).toEqual(dragged);
  });

  test(`a double click on a border of ${side} restores the heights the lists start with`, async ({ page }) => {
    const start = await heights(page, side);
    await drag(page, side, 1, -40);

    await page.locator(`${side} .splitter`).first().dblclick();

    expect(await heights(page, side)).toEqual(start);
  });

  test(`the arrow keys move a border of ${side}`, async ({ page }) => {
    const before = await heights(page, side);

    await page.locator(`${side} .splitter`).first().focus();
    await page.keyboard.press("ArrowUp");

    expect((await heights(page, side))[0]).toBeLessThan(before[0]);
  });
}

test("a collapsed list gives its height to the lists left open in proportion to theirs", async ({ page }) => {
  await drag(page, ".picker", 2, -60);
  const [boards, parts] = await heights(page, ".picker");

  await page.locator('[data-fold="rigs"]').click();

  const [grownBoards, grownParts] = await heights(page, ".picker");
  expect(grownBoards / grownParts).toBeCloseTo(boards / parts, 1);
});

test("the borders do not move on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });

  await expect(page.locator(".splitter").first()).toBeHidden();
});
