import type { Meta, StoryObj } from "@storybook/html-vite";
import { fromPage } from "./page";

const meta: Meta = { title: "Controls" };

export default meta;

type HeaderArgs = { labels: boolean };

/** The header and its buttons, with or without the names beside their icons. */
export const Header: StoryObj<HeaderArgs> = {
  args: { labels: true },
  render: ({ labels }) => {
    document.documentElement.dataset.labels = labels ? "on" : "off";
    return fromPage("header");
  },
};

type SidebarArgs = { side: "left" | "report"; open: boolean; boards: boolean; parts: boolean; rigs: boolean };

/**
 * A sidebar of the page, open or collapsed, with each list of the left sidebar open or folded; the pointer opens a
 * collapsed sidebar as it does on the page.
 */
export const Sidebar: StoryObj<SidebarArgs> = {
  args: { side: "left", open: true, boards: true, parts: true, rigs: true },
  argTypes: { side: { control: "inline-radio", options: ["left", "report"] } },
  render: ({ side, open, boards, parts, rigs }) => {
    const root = document.documentElement.dataset;
    root.left = side === "left" && !open ? "off" : "on";
    root.report = side === "report" && !open ? "off" : "on";
    Object.assign(root, { boards: boards ? "on" : "off", parts: parts ? "on" : "off", rigs: rigs ? "on" : "off" });
    const main = document.createElement("main");
    main.style.gridTemplateColumns = side === "left" ? "var(--left-col) minmax(0, 1fr)" : "minmax(0, 1fr) var(--right-col)";
    const sidebar = fromPage(side === "left" ? ".picker" : ".report-panel");
    const filler = document.createElement("section");
    filler.className = "panel stage";
    main.append(...(side === "left" ? [sidebar, filler] : [filler, sidebar]));
    return main;
  },
};
