import type { StorybookConfig } from "@storybook/html-vite";

/** Builds the stories without the page's `public/`, whose `_headers` holds the page's Content Security Policy. */
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.ts"],
  framework: "@storybook/html-vite",
  core: { disableTelemetry: true },
  viteFinal: (vite) => ({ ...vite, publicDir: false }),
};

export default config;
