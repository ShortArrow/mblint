import "./styles.css";
import init from "./wasm/mblint_wasm";
import { rigBundle, zip } from "./export";
import type { CodeEditor } from "./code";
import { downloadName, edit } from "./editor";
import { escape } from "./escape";
import { dataFiles } from "./files";
import { addLoaded, isLoadableName, type Loaded, resolveRig, sameRig, toWrite } from "./load";
import { catalog, check, type Files, layout, rebind } from "./mblint";
import type { CatalogEntry } from "./report/CatalogEntry";
import type { LayoutNode } from "./report/LayoutNode";
import type { Report } from "./report/Report";
import type { SocketCategory } from "./report/SocketCategory";
import { rigToml, takes } from "./rig";
import { newFile, newRig, type Template } from "./templates";
import { fetchRoot, parseAddress, rootOf, withRepository } from "./github";
import { flag, flagValue, readPref, removePref, writePref } from "./prefs";
import { dragWidth, moveBorder, PANE_MIN, type Side, storedHeights, storedWidth } from "./resize";
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
import { bracketHtml, colour, diagnosticsHtml, editable, interfaceText, linksHtml, noticesHtml } from "./view";

const RIG_PATH = "local/rig.toml";
const LABELS_KEY = "mblint-labels";
const LEFT_KEY = "mblint-left";
const REPORT_KEY = "mblint-report";
const DEFAULT_WIDTH: Record<Side, number> = { left: 230, right: 280 };

type Device = Extract<CatalogEntry, { kind: "device" }>;
type RigEntry = Extract<CatalogEntry, { kind: "rig" }>;

let files: Files = dataFiles(
  import.meta.glob<string>("../../data/**/*.toml", { query: "?raw", import: "default", eager: true }),
  "../../data/",
);
let entries: Record<string, CatalogEntry> = {};
let board: string | null = null;
let bindings: Record<string, string> = {};
let selected: string | null = null;
let notices: string[] = [];
let editing: string | null = null;
let pendingEdit: ReturnType<typeof setTimeout> | undefined;
let code: CodeEditor | null = null;
let loadingCode: Promise<CodeEditor> | null = null;
let openings = 0;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function boards(): [string, Extract<CatalogEntry, { kind: "board" }>][] {
  return Object.entries(entries).flatMap(([path, entry]) => (entry.kind === "board" ? [[path, entry]] : []));
}

function devices(): [string, Device][] {
  return Object.entries(entries)
    .flatMap(([path, entry]): [string, Device][] => (entry.kind === "device" ? [[path, entry]] : []))
    .sort(([, a], [, b]) => a.name.localeCompare(b.name));
}

function rigs(): [string, RigEntry][] {
  return Object.entries(entries)
    .flatMap(([path, entry]): [string, RigEntry][] => (entry.kind === "rig" ? [[path, entry]] : []))
    .sort(([, a], [, b]) => a.name.localeCompare(b.name));
}

/** Whether the rig being built is the rig `entry` at `path` names, every path it names found. */
function isApplied(path: string, entry: RigEntry): boolean {
  const resolved = resolveRig(entry.board, entry.bindings, files, rootOf(path));
  return board !== null && resolved.missing.length === 0 && sameRig(resolved, { board, bindings });
}

function renderReport(report: Report | null): void {
  const status = $("status");
  status.className = `status ${report?.status ?? ""}`;
  status.textContent = report?.status ?? "";
  $("report").innerHTML = diagnosticsHtml(report);
  $("links").innerHTML = linksHtml(report);
}

function render(): void {
  entries = catalog(files);
  if (board !== null && entries[board]?.kind !== "board") board = null;
  board ??= boards()[0]?.[0] ?? null;
  $<HTMLButtonElement>("new-rig").disabled = board === null;

  $("boards").innerHTML = boards()
    .map(([path, entry]) =>
      editable(
        `<button type="button" class="board-item ${path === board ? "selected" : ""}" data-board="${escape(path)}">
          <small>${escape(entry.vendor)}${path.startsWith("local/") ? " · loaded" : ""}</small><b>${escape(entry.model)}</b>
        </button>`,
        path,
        editing,
      ),
    )
    .join("");

  const parts = devices();
  $("parts").innerHTML = parts.length
    ? parts
        .map(([path, device]) =>
          editable(
            `<button type="button" class="part ${selected === path ? "selected" : ""}" draggable="true" data-part="${escape(path)}">
          <span class="chip" style="background:${colour(path)}"></span>
          <span><b>${escape(device.name)}</b><small class="mono">${escape(interfaceText(device))}${path.startsWith("local/") ? " · loaded" : ""}</small></span>
        </button>`,
            path,
            editing,
          ),
        )
        .join("")
    : `<p class="empty">No parts yet. Load device TOML files to add some.</p>`;

  const rigList = rigs();
  $("rigs").innerHTML = rigList.length
    ? rigList
        .map(([path, entry]) =>
          editable(
            `<button type="button" class="board-item ${isApplied(path, entry) ? "selected" : ""}" data-rig="${escape(path)}">
          <small>${escape(path.slice(path.lastIndexOf("/") + 1))}</small><b>${escape(entry.name)}</b>
        </button>`,
            path,
            editing,
          ),
        )
        .join("")
    : `<p class="empty">No rigs yet. Load rig TOML files to add some.</p>`;

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
  $("bracket").innerHTML = bracketHtml(nodes, { entries, report, selected });
  renderReport(report);
  $("notices").innerHTML = noticesHtml(notices);
}

function install(socket: string, part: string): void {
  settleEdit();
  bindings = { ...bindings, [socket]: part };
  selected = null;
  notices = [];
  writeRig(true);
  render();
}

/** The rig open in the editor, or null when the editor holds no rig. */
function openRig(): [string, RigEntry] | null {
  const entry = editing === null ? undefined : entries[editing];
  return entry?.kind === "rig" ? [editing!, entry] : null;
}

/**
 * Writes the rig being built into the rig open in the editor with `rebind`, keeping a binding
 * whose file was not loaded when `keepUnloaded`, and shows the new text in the editor.
 */
function writeRig(keepUnloaded: boolean): void {
  const open = openRig();
  if (open === null || board === null) return;
  const [path, entry] = open;
  const written = toWrite(entry, { board, bindings }, files, rootOf(path), keepUnloaded);
  const text = rebind(files[path]!, written.board, written.bindings);
  if (text === files[path]) return;
  files = { ...files, [path]: text };
  code?.show(text);
}

/** Takes an edit still waiting in the editor, so that a change made on the page builds on it. */
function settleEdit(): void {
  if (pendingEdit === undefined) return;
  clearTimeout(pendingEdit);
  pendingEdit = undefined;
  takeEdit();
}

async function load(fileList: FileList | File[]): Promise<void> {
  const chosen = [...fileList];
  const refused = chosen.filter((file) => !isLoadableName(file.name));
  const loaded: Loaded[] = await Promise.all(
    chosen
      .filter((file) => isLoadableName(file.name))
      .map(async (file) => ({ name: file.name, contents: await file.text() })),
  );
  if (chosen.length === 0) return;
  notices = refused.map((file) => `${file.name}: not loaded, as its name is not a plain file name`);
  add(loaded);
}

/** Adds `loaded` under `local/`, each file taking the effect of its kind, and shows the change. */
function add(loaded: Loaded[]): void {
  files = addLoaded(files, loaded);
  entries = catalog(files);
  for (const { name } of loaded) {
    const entry = entries[`local/${name}`]!;
    if (entry.kind === "invalid") {
      notices.push(`${name}: ${entry.message}`);
    } else if (entry.kind === "board") {
      board = `local/${name}`;
      bindings = {};
    } else if (entry.kind === "rig") {
      applyRig(`local/${name}`, entry);
    }
  }
  if (loaded.some(({ name }) => `local/${name}` === editing)) void openEditor(editing);
  else render();
}

/**
 * Adds the files `loaded` from the repository whose prefix is `root` in place of those loaded from
 * it before, applying its rig when it holds exactly one, and shows the change.
 */
function addRepository(root: string, loaded: Files, skipped: { path: string; reason: string }[]): void {
  files = withRepository(files, root, loaded);
  entries = catalog(files);
  notices = skipped.map(({ path, reason }) => `${path}: not loaded, as ${reason}`);
  const own = Object.keys(loaded).map((path) => [path, entries[path]!] as const);
  for (const [path, entry] of own) if (entry.kind === "invalid") notices.push(`${path}: ${entry.message}`);
  const repositoryRigs = own.filter(([, entry]) => entry.kind === "rig");
  if (repositoryRigs.length === 1) applyRig(repositoryRigs[0]![0], repositoryRigs[0]![1] as RigEntry);
  if (editing?.startsWith(root)) void openEditor(editing in files ? editing : null);
  else render();
}

/** Chooses the board of the rig in the file at `path` and installs its bindings, noting the paths no file supplies. */
function applyRig(path: string, entry: RigEntry): void {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const resolved = resolveRig(entry.board, entry.bindings, files, rootOf(path));
  board = resolved.board;
  bindings = resolved.bindings;
  selected = null;
  if (resolved.missing.length) notices.push(`${name} names files that were not loaded: ${resolved.missing.join(", ")}`);
}

function chooseBoard(path: string): void {
  if (path === board) return;
  settleEdit();
  board = path;
  bindings = {};
  notices = [];
  writeRig(false);
  render();
}

/** The editor, created once however often it is asked for while CodeMirror loads. */
function loadCode(): Promise<CodeEditor> {
  loadingCode ??= import("./code").then(({ codeEditor }) =>
    codeEditor($("editor-text"), () => (editing === null ? null : (entries[editing]?.kind ?? null)), scheduleEdit),
  );
  return loadingCode;
}

/**
 * Opens the file at `path` in the editor, loading the editor the first time, or closes it when
 * `path` is null. Of the calls made while the editor loads, the last one decides what is open.
 */
async function openEditor(path: string | null): Promise<void> {
  const opening = ++openings;
  if (path !== null && code === null) code = await loadCode();
  if (opening !== openings) return;
  clearTimeout(pendingEdit);
  pendingEdit = undefined;
  editing = path;
  $("editor").hidden = path === null;
  $("editor-path").textContent = path ?? "";
  code?.show(path === null ? "" : (files[path] ?? ""));
  showRefusal(null);
  const rig = openRig();
  if (rig !== null) {
    notices = [];
    applyRig(...rig);
  }
  render();
}

/** Shows why the editor's text is not taken, or hides the reason when `reason` is null. */
function showRefusal(reason: string | null): void {
  const error = $("editor-error");
  error.hidden = reason === null;
  error.textContent = reason ?? "";
  code?.mark(reason);
}

/** Takes the editor's text as the file being edited after a quarter of a second without another edit. */
function scheduleEdit(): void {
  clearTimeout(pendingEdit);
  pendingEdit = setTimeout(takeEdit, 250);
}

/** Takes the editor's text as the file being edited and evaluates it, or says why the text is not taken. */
function takeEdit(): void {
  pendingEdit = undefined;
  if (editing === null || code === null) return;
  const result = edit(files, editing, code.text());
  if ("refused" in result) {
    showRefusal(result.refused);
    return;
  }
  showRefusal(null);
  files = result.files;
  notices = [];
  entries = catalog(files);
  const rig = openRig();
  if (rig !== null) applyRig(...rig);
  render();
}

/** Hands `blob` to the browser as a download named `name`. */
function save(blob: Blob, name: string): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

type List = "boards" | "parts" | "rigs";
type Flag = "labels" | "left" | "report" | List;

const LISTS: List[] = ["boards", "parts", "rigs"];
const FLAG_KEYS: Record<Flag, string> = {
  labels: LABELS_KEY,
  left: LEFT_KEY,
  report: REPORT_KEY,
  boards: "mblint-boards",
  parts: "mblint-parts",
  rigs: "mblint-rigs",
};

/** Keeps `sidebar`, just collapsed under the pointer, from opening on hover until the pointer leaves it. */
function holdCollapsed(sidebar: HTMLElement | null): void {
  if (sidebar === null || !sidebar.matches(":hover")) return;
  sidebar.classList.add("held");
  sidebar.addEventListener("pointerleave", () => sidebar.classList.remove("held"), { once: true });
}

/** Sets the flag that the document attribute `data-<name>` shows, and stores it. */
function setFlag(name: Flag, on: boolean): void {
  document.documentElement.dataset[name] = flagValue(on);
  writePref(FLAG_KEYS[name], flagValue(on));
}

/** Shows the list `name` of the left sidebar open or collapsed, and tells the control in its heading. */
function showList(name: List, open: boolean): void {
  document.documentElement.dataset[name] = flagValue(open);
  document.querySelector(`[data-fold="${name}"]`)?.setAttribute("aria-expanded", String(open));
}

const widthKey = (side: Side) => `mblint-${side}-width`;

/** Draws the sidebar on `side` `width` pixels wide, and stores the width when `store` is set. */
function setWidth(side: Side, width: number, store: boolean): void {
  document.documentElement.style.setProperty(`--${side}-w`, `${width}px`);
  if (store) writePref(widthKey(side), String(width));
}

/** Lets the handle `handle` resize its sidebar by dragging, by the arrow keys, and back to the default by a double click. */
function resizable(handle: HTMLElement): void {
  const side = handle.dataset.resize as Side;
  handle.addEventListener("pointerdown", (down) => {
    down.preventDefault();
    const start = storedWidth(readPref(widthKey(side)), DEFAULT_WIDTH[side]);
    let width = start;
    const move = (event: PointerEvent) => {
      width = dragWidth(side, start, down.clientX, event.clientX);
      setWidth(side, width, false);
    };
    handle.setPointerCapture(down.pointerId);
    handle.classList.add("active");
    document.body.classList.add("resizing");
    handle.addEventListener("pointermove", move);
    handle.addEventListener(
      "lostpointercapture",
      () => {
        handle.removeEventListener("pointermove", move);
        handle.classList.remove("active");
        document.body.classList.remove("resizing");
        setWidth(side, width, true);
      },
      { once: true },
    );
  });
  handle.addEventListener("keydown", (event) => {
    const step = event.key === "ArrowLeft" ? -16 : event.key === "ArrowRight" ? 16 : 0;
    if (step === 0) return;
    event.preventDefault();
    const width = storedWidth(readPref(widthKey(side)), DEFAULT_WIDTH[side]);
    setWidth(side, dragWidth(side, width, 0, step), true);
  });
  handle.addEventListener("dblclick", () => {
    removePref(widthKey(side));
    document.documentElement.style.removeProperty(`--${side}-w`);
  });
}

const heightsKey = (side: Side) => `mblint-${side}-heights`;

/** The lists of `sidebar`, in order. */
function listsOf(sidebar: HTMLElement): HTMLElement[] {
  return [...sidebar.querySelectorAll<HTMLElement>(":scope > .full > :not(h2)")];
}

/** The height of `element` inside its border and padding, in pixels. */
function heightInside(element: HTMLElement): number {
  const style = getComputedStyle(element);
  const edges = ["borderTopWidth", "borderBottomWidth", "paddingTop", "paddingBottom"] as const;
  return edges.reduce((height, edge) => height - parseFloat(style[edge]), element.getBoundingClientRect().height);
}

/** Draws the lists of `sidebar` in proportion to `heights`, or as they start when `heights` is null, and stores them when `store` is set. */
function setHeights(sidebar: HTMLElement, heights: number[] | null, store: boolean): void {
  const key = heightsKey(sidebar.dataset.side as Side);
  sidebar.classList.toggle("sized", heights !== null);
  listsOf(sidebar).forEach((list, index) =>
    heights === null ? list.style.removeProperty("--grow") : list.style.setProperty("--grow", String(heights[index])),
  );
  if (store) heights === null ? removePref(key) : writePref(key, JSON.stringify(heights));
}

/**
 * The heights inside the border and padding of the lists of `sidebar` as drawn, the last open list taking any height they leave
 * empty, keeping the stored height of a collapsed list; and which lists are open.
 */
function measureLists(sidebar: HTMLElement): { heights: number[]; open: boolean[] } {
  const lists = listsOf(sidebar);
  const full = sidebar.querySelector<HTMLElement>(":scope > .full")!;
  const stored = storedHeights(readPref(heightsKey(sidebar.dataset.side as Side)), lists.length);
  const open = lists.map((list) => getComputedStyle(list).display !== "none");
  const heights = lists.map((list, index) => (open[index] ? heightInside(list) : (stored?.[index] ?? 2 * PANE_MIN)));
  const shown = [...full.children].filter((child) => getComputedStyle(child).display !== "none");
  const drawn = shown.at(-1)!.getBoundingClientRect().bottom - shown[0].getBoundingClientRect().top;
  const last = open.lastIndexOf(true);
  if (last >= 0) heights[last] += Math.max(0, full.clientHeight - drawn);
  return { heights, open };
}

/** Lets the border `handle` move height between the lists around it by dragging, by the arrow keys, and back to the start by a double click. */
function splittable(handle: HTMLElement): void {
  const sidebar = handle.closest<HTMLElement>(".sidebar")!;
  const border = [...sidebar.querySelectorAll(":scope > .full > h2")].indexOf(handle.parentElement!);
  handle.addEventListener("pointerdown", (down) => {
    down.preventDefault();
    const start = measureLists(sidebar);
    let heights: number[] | null = null;
    const move = (event: PointerEvent) => {
      heights = moveBorder(start.heights, start.open, border, event.clientY - down.clientY);
      setHeights(sidebar, heights, false);
    };
    handle.setPointerCapture(down.pointerId);
    handle.classList.add("active");
    document.body.classList.add("resizing");
    handle.addEventListener("pointermove", move);
    handle.addEventListener(
      "lostpointercapture",
      () => {
        handle.removeEventListener("pointermove", move);
        handle.classList.remove("active");
        document.body.classList.remove("resizing");
        if (heights !== null) setHeights(sidebar, heights, true);
      },
      { once: true },
    );
  });
  handle.addEventListener("keydown", (event) => {
    const step = event.key === "ArrowUp" ? -16 : event.key === "ArrowDown" ? 16 : 0;
    if (step === 0) return;
    event.preventDefault();
    const { heights, open } = measureLists(sidebar);
    setHeights(sidebar, moveBorder(heights, open, border, step), true);
  });
  handle.addEventListener("dblclick", () => setHeights(sidebar, null, true));
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
for (const name of LISTS) showList(name, flag(readPref(FLAG_KEYS[name]), true));
for (const side of ["left", "right"] as const) {
  const stored = readPref(widthKey(side));
  if (stored !== null) setWidth(side, storedWidth(stored, DEFAULT_WIDTH[side]), false);
}
document.querySelectorAll<HTMLElement>("[data-resize]").forEach(resizable);
document.querySelectorAll<HTMLElement>(".sidebar[data-side]").forEach((sidebar) => {
  const stored = storedHeights(readPref(heightsKey(sidebar.dataset.side as Side)), listsOf(sidebar).length);
  if (stored !== null) setHeights(sidebar, stored, false);
});
document.querySelectorAll<HTMLElement>(".splitter").forEach(splittable);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (themeChoice(storedTheme()) === "system") applyTheme("system");
});

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  for (const menu of document.querySelectorAll(".new-menu[open]")) if (!menu.contains(target)) menu.removeAttribute("open");
  const remove = target.closest<HTMLElement>("[data-remove]");
  if (remove) {
    settleEdit();
    const { [remove.dataset.remove!]: _, ...rest } = bindings;
    bindings = rest;
    writeRig(true);
    render();
    return;
  }
  const create = target.closest<HTMLElement>("[data-new]");
  if (create) {
    create.closest("details")?.removeAttribute("open");
    const kind = create.dataset.new!;
    if (kind === "rig" && board === null) return;
    const file = kind === "rig" ? newRig(files, board!, bindings) : newFile(files, kind as Template);
    notices = [];
    add([file]);
    void openEditor(`local/${file.name}`);
    return;
  }
  const open = target.closest<HTMLElement>("[data-edit]");
  if (open) {
    void openEditor(open.dataset.edit === editing ? null : open.dataset.edit!);
    return;
  }
  const fold = target.closest<HTMLElement>("[data-fold]");
  if (fold) {
    const name = fold.dataset.fold as List;
    const open = document.documentElement.dataset[name] !== "on";
    showList(name, open);
    writePref(FLAG_KEYS[name], flagValue(open));
    return;
  }
  const opener = target.closest<HTMLElement>("[data-open]");
  if (opener) {
    setFlag(opener.dataset.open as Flag, true);
    return;
  }
  const toggle = target.closest<HTMLElement>("[data-toggle]");
  if (toggle) {
    const name = toggle.dataset.toggle as Flag;
    const on = document.documentElement.dataset[name] !== "on";
    setFlag(name, on);
    if (!on) holdCollapsed(toggle.closest<HTMLElement>(".sidebar"));
    return;
  }
  const choice = target.closest<HTMLElement>("[data-board]");
  if (choice) {
    chooseBoard(choice.dataset.board!);
    return;
  }
  const rig = target.closest<HTMLElement>("[data-rig]");
  if (rig) {
    const path = rig.dataset.rig!;
    notices = [];
    applyRig(path, entries[path] as RigEntry);
    render();
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
  if (socket && takes(entries, part, socket.dataset.category as SocketCategory)) install(socket.dataset.socket!, part);
});

$<HTMLInputElement>("file").addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;
  if (input.files) void load(input.files).then(() => (input.value = ""));
});
$("export").addEventListener("click", () => {
  if (board === null) return;
  const marked = rigs().find(([path, entry]) => isApplied(path, entry));
  const name = (marked?.[1].name ?? "rig").replace(/[^\w.-]/g, "_");
  save(new Blob([zip(rigBundle(files, board, bindings, name))], { type: "application/zip" }), `${name}.zip`);
});

$("editor-close").addEventListener("click", () => void openEditor(null));
$("editor-download").addEventListener("click", () => {
  clearTimeout(pendingEdit);
  takeEdit();
  if (editing !== null) save(new Blob([files[editing] ?? ""], { type: "application/toml" }), downloadName(editing));
});

$("clear").addEventListener("click", () => {
  settleEdit();
  bindings = {};
  notices = [];
  writeRig(false);
  render();
});
$("theme").addEventListener("click", (event) =>
  switchTheme(toggleTheme(document.documentElement.dataset.theme as Theme), event.currentTarget as HTMLElement),
);
const github = $<HTMLDialogElement>("github");
$("github-open").addEventListener("click", () => {
  $("github-error").hidden = true;
  github.showModal();
});
github.addEventListener("click", (event) => {
  if (event.target === github) github.close();
});
$("github-close").addEventListener("click", () => github.close());
$<HTMLFormElement>("github-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = $("github-error");
  const showError = (message: string) => {
    error.textContent = message;
    error.hidden = false;
  };
  const address = parseAddress($<HTMLInputElement>("github-address").value);
  if (address === null) {
    showError("Give the address of a repository on github.com, such as https://github.com/owner/repo.");
    return;
  }
  const button = $<HTMLButtonElement>("github-load");
  button.disabled = true;
  error.hidden = true;
  try {
    const root = await fetchRoot(address, (url) => fetch(url));
    if ("refused" in root) {
      showError(root.refused);
      return;
    }
    github.close();
    addRepository(`github/${address.owner}/${address.repo}/`, root.files, root.skipped);
  } catch {
    showError("GitHub could not be reached.");
  } finally {
    button.disabled = false;
  }
});

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
