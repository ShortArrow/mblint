import type { Meta, StoryObj } from "@storybook/html-vite";
import type { Report } from "../report/Report";
import { diagnosticsHtml, linksHtml, noticesHtml } from "../view";

const REPORT = {
  status: "error",
  diagnostics: [
    { pass: "physical", severity: "error", message: "M2_2 is disabled while SATA1 is in use.", code: "SHARED_LANES" },
    { pass: "throughput", severity: "warning", message: "PCIE1 runs at Gen4 x8, narrower than the card asks.", code: "BOTTLENECK" },
  ],
  links: { PCIE1: { generation: 4, lanes: 8, gbps: 15.75 }, M2_1: { generation: 5, lanes: 4, gbps: 15.75 } },
} as unknown as Report;

/** Wraps `html` in an element of `className`. */
function block(className: string, html: string): HTMLElement {
  const element = document.createElement("div");
  element.className = className;
  element.innerHTML = html;
  return element;
}

const meta: Meta = { title: "Report" };

export default meta;

export const Diagnostics: StoryObj = { render: () => block("panel", diagnosticsHtml(REPORT)) };

export const NoDiagnostics: StoryObj = { render: () => block("panel", diagnosticsHtml(null)) };

export const Links: StoryObj = { render: () => block("panel links", linksHtml(REPORT)) };

/** The indicator in the header, for each status a report can have. */
export const Indicators: StoryObj = {
  render: () => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "16px";
    for (const status of ["ok", "warning", "error"]) {
      const indicator = document.createElement("span");
      indicator.className = `status ${status}`;
      indicator.textContent = status;
      row.append(indicator);
    }
    return row;
  },
};

export const Toasts: StoryObj = {
  render: () =>
    block(
      "notices",
      noticesHtml(["rigs/desk.toml names files that were not loaded: devices/gpu.toml", "board.toml: not loaded, as its name is not a plain file name"]),
    ),
};
