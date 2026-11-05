import { defineConfig } from "@playwright/test";

/** Opens every story of the built Storybook in Chromium; `npm run build-storybook` builds it first. */
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.stories.ts",
  workers: 2,
  use: { baseURL: "http://localhost:6007", viewport: { width: 1440, height: 900 } },
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --outDir storybook-static --port 6007 --strictPort",
    url: "http://localhost:6007",
    reuseExistingServer: false,
  },
});
