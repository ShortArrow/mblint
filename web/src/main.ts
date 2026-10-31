import "./styles.css";
import init from "./wasm/mblint_wasm";
import { type Block, linkGbps, rootBars, scaleFor, socketBars } from "./bars";
import { dataFiles } from "./files";
import { addLoaded, type Loaded, resolveRig } from "./load";
import { catalog, check, type Files, layout } from "./mblint";
import type { CatalogEntry } from "./report/CatalogEntry";
import type { LayoutNode } from "./report/LayoutNode";
import type { LinkWidth } from "./report/LinkWidth";
import type { Report } from "./report/Report";
import { rigToml } from "./rig";
import { flag, flagValue, readPref, writePref } from "./prefs";
import {
  applyTheme,
  coverRadius,
  prefersDark,
  resolveTheme,
  storedTheme,
  type Theme,
  type ThemeChoice,
  themeChoice,
  toggleTheme,
} from "./theme";
import { bracket, type TreeNode } from "./tree";

const RIG_PATH = "local/rig.toml";
const BAR_PX = 112;
const LABELS_KEY = "mblint-labels";
const LEFT_KEY = "mblint-left";
const REPORT_KEY = "mblint-report";

type Device = Extract<CatalogEntry, { kind: "device" }>;
type Socket = Extract<LayoutNode, { kind: "socket" }>;

let files: Files = dataFiles(
  import.meta.glob<string>("../../data/**/*.toml", { query: "?raw", import: "default", eager: true }),
  "../../data/",
);
let entries: Record<string, CatalogEntry> = {};
let board: string | null = null;
let bindings: Record<string, string> = {};
let selected: string | null = null;
let notices: string[] = [];
let scale = { gbps: 0, lane: 0 };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function boards(): [string, Extract<CatalogEntry, { kind: "board" }>][] {
  return Object.entries(entries).flatMap(([path, entry]) => (entry.kind === "board" ? [[path, entry]] : []));
}

function devices(): [string, Device][] {
  return Object.entries(entries)
    .flatMap(([path, entry]): [string, Device][] => (entry.kind === "device" ? [[path, entry]] : []))
    .sort(([, a], [, b]) => a.name.localeCompare(b.name));
}

function colour(path: string): string {
  let hash = 0;
  for (const c of path) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 62% 50%)`;
}

function linkText(link: LinkWidth): string {
  return `Gen${link.generation} x${link.lanes}`;
}

function interfaceText(device: Device): string {
  return device.interface ? `${device.interface.protocol.toUpperCase()} ${linkText(device.interface)}` : device.type;
}

function blocks(row: Block[], px: number, colourOf: (block: Block) => string): string {
  return row
    .map((block) => `<span class="blk ${block.mark ?? ""}" style="width:${block.width * px}px;background:${colourOf(block)}"></span>`)
    .join("");
}

function barRow(label: string, bar: string, text: string): string {
  return `<div class="bar-row"><span class="bar-label">${label}</span><span class="bar">${bar}</span><span class="bar-text mono">${escape(text)}</span></div>`;
}

function socketHtml(id: string, socket: Socket, report: Report | null): string {
  const device = socket.device === null ? null : entries[socket.device];
  const name = device?.kind === "device" ? device.name : socket.device;
  const tint = socket.device === null ? "var(--supply)" : colour(socket.device);
  const bars = socketBars(socket.needs, socket.offers);
  const rows = [
    bars.needs ? barRow("needs", blocks(bars.needs, scale.gbps, () => tint), linkText(socket.needs!)) : "",
    bars.offers ? barRow("offers", blocks(bars.offers, scale.gbps, () => "var(--supply)"), linkText(socket.offers!)) : "",
  ].join("");
  const finding = report?.diagnostics.find((d) => "socket" in d && d.socket === id);
  const link = report?.links[id];
  const part = selected === null ? undefined : entries[selected];
  const target = part?.kind === "device" && part.socket_category === socket.category;
  return `<div class="node socket ${socket.disabled ? "disabled" : ""} ${finding ? `flag-${finding.severity}` : ""} ${target ? "target" : ""}" data-socket="${escape(id)}">
    <div class="title"><b class="mono">${escape(id)}</b><span class="meta">${socket.category.replace("_", " ")}${socket.slot_index === null ? "" : ` · slot ${socket.slot_index}`}</span></div>
    ${
      name === null
        ? `<div class="device meta">${socket.disabled ? "disabled by a mux" : "empty"}</div>`
        : `<div class="device"><span class="dot" style="background:${tint}"></span>${escape(name)}<button class="remove" type="button" data-remove="${escape(id)}" aria-label="Remove">✕</button></div>`
    }
    ${rows ? `<div class="bars">${rows}</div>` : ""}
    ${link ? `<div class="meta mono">link ${linkText(link)} · ${link.gbps.toFixed(2)} Gbps</div>` : ""}
  </div>`;
}

function nodeHtml(tree: TreeNode, report: Report | null): string {
  const { id, node } = tree;
  switch (node.kind) {
    case "socket":
      return socketHtml(id, node, report);
    case "root": {
      const bars = rootBars(node.demanded, node.supplied);
      return `<div class="node root"><div class="title"><b class="mono">${escape(id)}</b><span class="meta">Gen${node.generation}</span></div>
        <div class="bars">
          ${barRow("needs", blocks(bars.needs, scale.lane, () => "var(--accent)"), `${node.demanded} lanes`)}
          ${barRow("gives", blocks(bars.gives, scale.lane, () => "var(--supply)"), `${node.supplied} lanes`)}
        </div></div>`;
    }
    case "mux":
      return `<div class="node mux"><div class="title"><b class="mono">${escape(id)}</b><span class="meta">mux</span></div>
        <div class="meta">${node.mode === null ? "no mode holds" : `mode ${node.mode + 1}`}</div></div>`;
    case "bridge":
      return `<div class="node"><div class="title"><b class="mono">${escape(id)}</b><span class="meta">bridge</span></div>
        <div class="meta">demands ${node.lanes} lanes</div></div>`;
    case "controller":
      return "";
  }
}

function branchHtml(tree: TreeNode, report: Report | null): string {
  const live = tree.node.kind === "socket" && tree.node.device !== null;
  const kids = tree.children.length
    ? `<div class="kids">${tree.children.map((child) => branchHtml(child, report)).join("")}</div>`
    : "";
  return `<div class="branch ${live ? "live" : ""}"><span class="wire"></span>${nodeHtml(tree, report)}${kids}</div>`;
}

/** Pixels per Gbps and per lane that draw the longest socket bar and the longest root bar `BAR_PX` wide. */
function boardScale(nodes: LayoutNode[]): { gbps: number; lane: number } {
  const links = nodes.flatMap((node) => (node.kind === "socket" ? [node.needs, node.offers] : []));
  const roots = nodes.flatMap((node) => (node.kind === "root" ? [node.demanded, node.supplied] : []));
  return {
    gbps: scaleFor(links.flatMap((link) => (link === null ? [] : [linkGbps(link)])), BAR_PX),
    lane: scaleFor(roots, BAR_PX),
  };
}

function renderBracket(nodes: Record<string, LayoutNode> | null, report: Report | null): void {
  if (nodes === null) {
    $("bracket").innerHTML = `<p class="empty">Load a board to start.</p>`;
    return;
  }
  const { roots, unknown } = bracket(nodes);
  scale = boardScale(Object.values(nodes));
  const groups = roots.map(
    (root) => `<div class="group"><div class="tree">${nodeHtml(root, report)}${
      root.children.length ? `<div class="kids">${root.children.map((c) => branchHtml(c, report)).join("")}</div>` : ""
    }</div></div>`,
  );
  if (unknown.length) {
    groups.push(
      `<div class="group"><p class="group-title">Upstream not stated</p><div class="loose">${unknown
        .map((tree) => nodeHtml(tree, report))
        .join("")}</div></div>`,
    );
  }
  $("bracket").innerHTML = groups.join("");
}

function renderReport(report: Report | null): void {
  const status = $("status");
  status.className = `status ${report?.status ?? ""}`;
  status.textContent = report?.status ?? "";
  $("report").innerHTML =
    report === null || report.diagnostics.length === 0
      ? `<p class="empty">No diagnostics.</p>`
      : report.diagnostics
          .map((d) => `<div class="diag"><span class="sev ${d.severity}">${d.severity}</span><span>${escape(d.message)}<code>${d.code}</code></span></div>`)
          .join("");
  const rows = Object.entries(report?.links ?? {})
    .map(([socket, link]) => `<tr><td class="mono">${escape(socket)}</td><td class="mono">${linkText(link!)} · ${link!.gbps.toFixed(2)} Gbps</td></tr>`)
    .join("");
  $("links").innerHTML = rows ? `<table>${rows}</table>` : `<span class="meta">No links.</span>`;
}

function render(): void {
  entries = catalog(files);
  if (board !== null && entries[board]?.kind !== "board") board = null;
  board ??= boards()[0]?.[0] ?? null;

  $("boards").innerHTML = boards()
    .map(([path, entry]) => `<button type="button" class="board-item ${path === board ? "selected" : ""}" data-board="${escape(path)}">
          <small>${escape(entry.vendor)}${path.startsWith("local/") ? " · loaded" : ""}</small><b>${escape(entry.model)}</b>
        </button>`)
    .join("");

  const parts = devices();
  $("parts").innerHTML = parts.length
    ? parts
        .map(([path, device]) => `<button type="button" class="part ${selected === path ? "selected" : ""}" draggable="true" data-part="${escape(path)}">
          <span class="chip" style="background:${colour(path)}"></span>
          <span><b>${escape(device.name)}</b><small class="mono">${escape(interfaceText(device))}${path.startsWith("local/") ? " · loaded" : ""}</small></span>
        </button>`)
        .join("")
    : `<p class="empty">No parts yet. Load device TOML files to add some.</p>`;

  let nodes: Record<string, LayoutNode> | null = null;
  let report: Report | null = null;
  if (board !== null) {
    const rigFiles = { ...files, [RIG_PATH]: rigToml(board, bindings) };
    try {
      nodes = layout(rigFiles, RIG_PATH);
      report = check(rigFiles, RIG_PATH);
    } catch (error) {
      notices = [...notices, (error as Error).message];
    }
  }
  renderBracket(nodes, report);
  renderReport(report);
  $("notices").innerHTML = notices.map((n) => `<div class="notice">${escape(n)}</div>`).join("");
}

function install(socket: string, part: string): void {
  bindings = { ...bindings, [socket]: part };
  selected = null;
  notices = [];
  render();
}

async function load(fileList: FileList | File[]): Promise<void> {
  const loaded: Loaded[] = await Promise.all(
    [...fileList].map(async (file) => ({ name: file.name, contents: await file.text() })),
  );
  if (loaded.length === 0) return;
  files = addLoaded(files, loaded);
  entries = catalog(files);
  notices = [];
  const names = loaded.map((file) => file.name);
  for (const { name } of loaded) {
    const entry = entries[`local/${name}`]!;
    if (entry.kind === "invalid") {
      notices.push(`${name}: ${entry.message}`);
    } else if (entry.kind === "board") {
      board = `local/${name}`;
      bindings = {};
    } else if (entry.kind === "rig") {
      const resolved = resolveRig(entry.board, entry.bindings, files, names);
      board = resolved.board;
      bindings = resolved.bindings;
      if (resolved.missing.length) notices.push(`${name} names files that were not loaded: ${resolved.missing.join(", ")}`);
    }
  }
  render();
}

function chooseBoard(path: string): void {
  if (path === board) return;
  board = path;
  bindings = {};
  notices = [];
  render();
}

type Flag = "labels" | "left" | "report";

const FLAG_KEYS: Record<Flag, string> = { labels: LABELS_KEY, left: LEFT_KEY, report: REPORT_KEY };

/** Sets the flag that the document attribute `data-<name>` shows, and stores it. */
function setFlag(name: Flag, on: boolean): void {
  document.documentElement.dataset[name] = flagValue(on);
  writePref(FLAG_KEYS[name], flagValue(on));
}

/** Applies `choice`, revealing the new theme in a circle growing from `origin` when it changes. */
function switchTheme(choice: ThemeChoice, origin: HTMLElement): void {
  const apply = () => applyTheme(choice);
  const next = resolveTheme(choice === "system" ? null : choice, prefersDark());
  const start = (document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } })
    .startViewTransition;
  if (!start || next === document.documentElement.dataset.theme || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    apply();
    return;
  }
  const rect = origin.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = coverRadius(x, y, innerWidth, innerHeight);
  start.call(document, apply).ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 400, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" },
    );
  });
}

document.documentElement.dataset.theme = resolveTheme(storedTheme(), prefersDark());
document.documentElement.dataset.labels = flagValue(flag(readPref(LABELS_KEY), false));
document.documentElement.dataset.left = flagValue(flag(readPref(LEFT_KEY), true));
document.documentElement.dataset.report = flagValue(flag(readPref(REPORT_KEY), true));
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (themeChoice(storedTheme()) === "system") applyTheme("system");
});

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const remove = target.closest<HTMLElement>("[data-remove]");
  if (remove) {
    const { [remove.dataset.remove!]: _, ...rest } = bindings;
    bindings = rest;
    render();
    return;
  }
  const toggle = target.closest<HTMLElement>("[data-toggle]");
  if (toggle) {
    const name = toggle.dataset.toggle as Flag;
    setFlag(name, document.documentElement.dataset[name] !== "on");
    return;
  }
  const choice = target.closest<HTMLElement>("[data-board]");
  if (choice) {
    chooseBoard(choice.dataset.board!);
    return;
  }
  const part = target.closest<HTMLElement>("[data-part]");
  if (part) {
    selected = selected === part.dataset.part ? null : part.dataset.part!;
    render();
    return;
  }
  const socket = target.closest<HTMLElement>("[data-socket]");
  if (socket && selected !== null && socket.classList.contains("target")) install(socket.dataset.socket!, selected);
});

document.addEventListener("dragstart", (event) => {
  const part = (event.target as HTMLElement).closest<HTMLElement>("[data-part]");
  if (part && event.dataTransfer) {
    selected = part.dataset.part!;
    event.dataTransfer.setData("text/x-mblint-part", selected);
    render();
  }
});
document.addEventListener("dragover", (event) => {
  const types = event.dataTransfer?.types ?? [];
  const onTarget = (event.target as HTMLElement).closest(".node.socket.target");
  if (types.includes("Files") || (types.includes("text/x-mblint-part") && onTarget)) {
    event.preventDefault();
    document.body.classList.toggle("dropping", types.includes("Files"));
  }
});
document.addEventListener("dragleave", (event) => {
  if (event.relatedTarget === null) document.body.classList.remove("dropping");
});
document.addEventListener("drop", (event) => {
  document.body.classList.remove("dropping");
  const transfer = event.dataTransfer;
  if (!transfer) return;
  event.preventDefault();
  if (transfer.files.length) {
    void load(transfer.files);
    return;
  }
  const socket = (event.target as HTMLElement).closest<HTMLElement>(".node.socket.target");
  const part = transfer.getData("text/x-mblint-part");
  if (socket && part) install(socket.dataset.socket!, part);
});

$<HTMLInputElement>("file").addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;
  if (input.files) void load(input.files).then(() => (input.value = ""));
});
$("clear").addEventListener("click", () => {
  bindings = {};
  notices = [];
  render();
});
$("theme").addEventListener("click", (event) =>
  switchTheme(toggleTheme(document.documentElement.dataset.theme as Theme), event.currentTarget as HTMLElement),
);
const settings = $<HTMLDialogElement>("settings");
$("settings-open").addEventListener("click", () => {
  const choice = themeChoice(storedTheme());
  settings.querySelectorAll<HTMLInputElement>("input[name=theme]").forEach((input) => (input.checked = input.value === choice));
  $<HTMLInputElement>("labels").checked = document.documentElement.dataset.labels === "on";
  settings.showModal();
});
settings.addEventListener("click", (event) => {
  if (event.target === settings) settings.close();
});
settings.addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;
  if (input.name === "theme") switchTheme(input.value as ThemeChoice, input);
  else if (input.id === "labels") setFlag("labels", input.checked);
});

await init();
render();
