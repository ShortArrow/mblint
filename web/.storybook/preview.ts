import type { Preview } from "@storybook/html-vite";
import "../src/styles.css";

/** The theme `choice` names, the system's when it is `system`. */
function resolved(choice: string): string {
  if (choice !== "system") return choice;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Draws each story in the theme the toolbar picks, the system's until it picks one, on the page's background. */
const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Theme of the page",
      toolbar: { icon: "contrast", items: ["system", "light", "dark"], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "system" },
  decorators: [
    (story, context) => {
      document.documentElement.dataset.theme = resolved(context.globals.theme);
      document.body.style.padding = "16px";
      return story();
    },
  ],
};

export default preview;
