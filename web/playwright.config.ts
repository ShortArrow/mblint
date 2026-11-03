import { defineConfig } from "@playwright/test";

/** Tests that need a browser's layout: run against the dev server in Chromium, on a screen wide enough for both sidebars. */
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  workers: 2,
  use: { baseURL: "http://localhost:4175", viewport: { width: 1440, height: 900 } },
  webServer: { command: "node node_modules/vite/bin/vite.js --port 4175 --strictPort", url: "http://localhost:4175", reuseExistingServer: false },
});
