import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const index = JSON.parse(readFileSync(join(import.meta.dirname, "../storybook-static/index.json"), "utf8")) as {
  entries: Record<string, { id: string; type: string }>;
};
const stories = Object.values(index.entries).filter((entry) => entry.type === "story");

test("the built Storybook holds stories", () => {
  expect(stories.length).toBeGreaterThan(0);
});

for (const { id } of stories) {
  test(`the story ${id} draws without an error`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.goto(`/iframe.html?id=${id}&viewMode=story`);

    await expect(page.locator("#storybook-root")).not.toBeEmpty();
    expect(errors).toEqual([]);
  });
}
