import { type Block, linkGbps, rootBars, scaleFor, socketBars } from "./bars";
import { downloadName } from "./editor";
import { escape } from "./escape";
import type { CatalogEntry } from "./report/CatalogEntry";
import type { LayoutNode } from "./report/LayoutNode";
import type { LinkWidth } from "./report/LinkWidth";
import type { Report } from "./report/Report";
import { takes } from "./rig";
import { bracket, type TreeNode } from "./tree";

const BAR_PX = 112;

type Device = Extract<CatalogEntry, { kind: "device" }>;
type Socket = Extract<LayoutNode, { kind: "socket" }>;

/** What drawing the bracket needs besides its layout: the catalog, the report on it and the part selected for placing. */
export type BracketContext = {
  entries: Record<string, CatalogEntry>;
  report: Report | null;
  selected: string | null;
};

type Scale = { gbps: number; lane: number };

/** The list item `item` with the control that opens the file at `path` in the editor, marked when `path` is `editing`. */
export function editable(item: string, path: string, editing: string | null): string {
  return `<div class="item">${item}<button type="button" class="tool edit ${path === editing ? "selected" : ""}" data-edit="${escape(path)}" title="Edit ${escape(downloadName(path))}">
    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 2.5l3 3-8 8h-3v-3zM9 4l3 3" /></svg>
  </button></div>`;
}

/** The colour that marks the part at `path` wherever it is drawn. */
export function colour(path: string): string {
  let hash = 0;
  for (const c of path) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 62% 50%)`;
}

export function linkText(link: LinkWidth): string {
  return `Gen${link.generation} x${link.lanes}`;
}

export function interfaceText(device: Device): string {
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

function socketHtml(id: string, socket: Socket, context: BracketContext, scale: Scale): string {
  const { entries, report, selected } = context;
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
  const target = takes(entries, selected, socket.category);
  return `<div class="node socket ${socket.disabled ? "disabled" : ""} ${finding ? `flag-${finding.severity}` : ""} ${target ? "target" : ""}" data-socket="${escape(id)}" data-category="${socket.category}">
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

function nodeHtml(tree: TreeNode, context: BracketContext, scale: Scale): string {
  const { id, node } = tree;
  switch (node.kind) {
    case "socket":
      return socketHtml(id, node, context, scale);
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

function branchHtml(tree: TreeNode, context: BracketContext, scale: Scale): string {
  const live = tree.node.kind === "socket" && tree.node.device !== null;
  const kids = tree.children.length
    ? `<div class="kids">${tree.children.map((child) => branchHtml(child, context, scale)).join("")}</div>`
    : "";
  return `<div class="branch ${live ? "live" : ""}"><span class="wire"></span>${nodeHtml(tree, context, scale)}${kids}</div>`;
}

/** Pixels per Gbps and per lane that draw the longest socket bar and the longest root bar `BAR_PX` wide. */
function boardScale(nodes: LayoutNode[]): Scale {
  const links = nodes.flatMap((node) => (node.kind === "socket" ? [node.needs, node.offers] : []));
  const roots = nodes.flatMap((node) => (node.kind === "root" ? [node.demanded, node.supplied] : []));
  return {
    gbps: scaleFor(links.flatMap((link) => (link === null ? [] : [linkGbps(link)])), BAR_PX),
    lane: scaleFor(roots, BAR_PX),
  };
}

/** The bracket of the board laid out as `nodes`, or a prompt to load a board when there is none. */
export function bracketHtml(nodes: Record<string, LayoutNode> | null, context: BracketContext): string {
  if (nodes === null) return `<p class="empty">Load a board to start.</p>`;
  const { roots, unknown } = bracket(nodes);
  const scale = boardScale(Object.values(nodes));
  const groups = roots.map(
    (root) => `<div class="group"><div class="tree">${nodeHtml(root, context, scale)}${
      root.children.length ? `<div class="kids">${root.children.map((c) => branchHtml(c, context, scale)).join("")}</div>` : ""
    }</div></div>`,
  );
  if (unknown.length) {
    groups.push(
      `<div class="group"><p class="group-title">Upstream not stated</p><div class="loose">${unknown
        .map((tree) => nodeHtml(tree, context, scale))
        .join("")}</div></div>`,
    );
  }
  return groups.join("");
}

/** The diagnostics of `report`, or a line saying there are none. */
export function diagnosticsHtml(report: Report | null): string {
  return report === null || report.diagnostics.length === 0
    ? `<p class="empty">No diagnostics.</p>`
    : report.diagnostics
        .map((d) => `<div class="diag"><span class="sev ${d.severity}">${d.severity}</span><span>${escape(d.message)}<code>${d.code}</code></span></div>`)
        .join("");
}

/** The links of `report` as a table, or a line saying there are none. */
export function linksHtml(report: Report | null): string {
  const rows = Object.entries(report?.links ?? {})
    .map(([socket, link]) => `<tr><td class="mono">${escape(socket)}</td><td class="mono">${linkText(link!)} · ${link!.gbps.toFixed(2)} Gbps</td></tr>`)
    .join("");
  return rows ? `<table>${rows}</table>` : `<span class="meta">No links.</span>`;
}

/** Each of `notices` as a toast. */
export function noticesHtml(notices: string[]): string {
  return notices.map((n) => `<div class="notice">${escape(n)}</div>`).join("");
}
