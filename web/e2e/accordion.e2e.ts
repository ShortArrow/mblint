import { expect, type Page, test } from "@playwright/test";

const LISTS = { Boards: "#boards", Parts: "#parts", Rigs: "#rigs" } as const;
type Heading = keyof typeof LISTS;

/** Clicks the heading named `name` in the left sidebar. */
async function fold(page: Page, name: Heading): Promise<void> {
  await page.locator(".picker h2", { hasText: name }).getByRole("button", { name }).click();
}

/** The height of the left sidebar's contents that its headings and lists leave empty, in CSS pixels. */
async function emptyHeight(page: Page): Promise<number> {
  return page.evaluate(() => {
    const full = document.querySelector(".picker > .full")!;
    const children = [...full.children].filter((child) => getComputedStyle(child).display !== "none");
    const filled = children.reduce((sum, child) => sum + child.getBoundingClientRect().height, 0);
    return Math.round(full.clientHeight - filled);
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#bracket .node").first()).toBeVisible();
});

for (const [name, list] of Object.entries(LISTS) as [Heading, string][]) {
  test(`the ${name} heading collapses its list to the heading and opens it again`, async ({ page }) => {
    await fold(page, name);

    await expect(page.locator(list)).toBeHidden();
    await expect(page.locator(".picker h2", { hasText: name })).toBeVisible();

    await fold(page, name);

    await expect(page.locator(list)).toBeVisible();
  });

  test(`the lists left open fill the sidebar with the ${name} list collapsed`, async ({ page }) => {
    await fold(page, name);

    expect(await emptyHeight(page)).toBe(0);
  });
}

test("the lists left open fill the sidebar with only the rigs open", async ({ page }) => {
  await fold(page, "Boards");
  await fold(page, "Parts");

  expect(await emptyHeight(page)).toBe(0);
});

test("the browser remembers which lists are open", async ({ page }) => {
  await fold(page, "Rigs");

  await page.reload();

  await expect(page.locator("#rigs")).toBeHidden();
  await expect(page.locator("#boards")).toBeVisible();
});

test("the controls that create a file neither collapse nor open their list", async ({ page }) => {
  await page.locator('[data-new="board"]').click();
  await page.locator(".new-menu > summary").click();

  await expect(page.locator("#boards")).toBeVisible();
  await expect(page.locator("#parts")).toBeVisible();
});
