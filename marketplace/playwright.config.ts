import { defineConfig } from "@playwright/test";

/** Tests of the page's look, which need a browser's layout: the rendered page is opened in Chromium without a server. */
export default defineConfig({
  testDir: "look",
  testMatch: "*.look.ts",
  workers: 2,
  use: { viewport: { width: 1440, height: 900 } },
});
