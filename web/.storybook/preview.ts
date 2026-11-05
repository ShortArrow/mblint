import type { Preview } from "@storybook/html-vite";
import "../src/styles.css";

/** Draws each story in the theme the toolbar picks, on the page's background. */
const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Theme of the page",
      toolbar: { icon: "contrast", items: ["light", "dark"], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [
    (story, context) => {
      document.documentElement.dataset.theme = context.globals.theme;
      document.body.style.padding = "16px";
      return story();
    },
  ],
};

export default preview;
