import type { Meta, StoryObj } from "@storybook/html-vite";
import type { CatalogEntry } from "../report/CatalogEntry";
import type { LayoutNode } from "../report/LayoutNode";
import type { Report } from "../report/Report";
import { bracketHtml } from "../view";

type Socket = Extract<LayoutNode, { kind: "socket" }>;

const ENTRIES: Record<string, CatalogEntry> = {
  "devices/gpu.toml": {
    kind: "device",
    name: "Graphics card",
    type: "card",
    interface: { protocol: "pcie", generation: 4, lanes: 16 },
    socket_category: "pcie_slot",
  },
  "devices/ssd.toml": {
    kind: "device",
    name: "NVMe drive",
    type: "m2_module",
    interface: { protocol: "pcie", generation: 5, lanes: 4 },
    socket_category: "m2_slot",
  },
};

const ROOT: LayoutNode = { kind: "root", parent: null, generation: 5, supplied: 24, demanded: 20 };

/** A socket under the root, empty and offering Gen5 x16 unless `socket` says otherwise. */
function socket(socket: Partial<Socket> = {}): Socket {
  return {
    kind: "socket",
    parent: "root_cpu",
    category: "pcie_slot",
    slot_index: 1,
    device: null,
    disabled: false,
    offers: { generation: 5, lanes: 16 },
    needs: null,
    ...socket,
  };
}

/** A report on the socket `PCIE1` alone: a finding of `severity` when one is given, and the link it settles on. */
function report(severity: "error" | "warning" | null): Report {
  return {
    status: severity ?? "ok",
    diagnostics:
      severity === null ? [] : [{ pass: "lanes", severity, message: "PCIE1 runs narrower than the card asks.", code: "BOTTLENECK", socket: "PCIE1" }],
    links: { PCIE1: { generation: 4, lanes: 8, gbps: 15.75 } },
  } as unknown as Report;
}

type Args = { nodes: Record<string, LayoutNode> | null; report: Report | null; selected: string | null };

/** The bracket of `nodes`, as the page draws it. */
const meta: Meta<Args> = {
  title: "Bracket",
  render: ({ nodes, report, selected }) => {
    const bracket = document.createElement("div");
    bracket.className = "bracket";
    bracket.innerHTML = bracketHtml(nodes, { entries: ENTRIES, report, selected });
    return bracket;
  },
  args: { report: null, selected: null },
};

export default meta;

type Story = StoryObj<Args>;

export const EmptyCard: Story = { args: { nodes: { root_cpu: ROOT, PCIE1: socket() } } };

export const FilledCard: Story = {
  args: { nodes: { root_cpu: ROOT, PCIE1: socket({ device: "devices/gpu.toml", needs: { generation: 4, lanes: 16 } }) }, report: report(null) },
};

export const WarningCard: Story = {
  args: { nodes: { root_cpu: ROOT, PCIE1: socket({ device: "devices/gpu.toml", needs: { generation: 4, lanes: 16 } }) }, report: report("warning") },
};

export const ErrorCard: Story = {
  args: { nodes: { root_cpu: ROOT, PCIE1: socket({ device: "devices/gpu.toml", needs: { generation: 4, lanes: 16 } }) }, report: report("error") },
};

export const DisabledCard: Story = { args: { nodes: { root_cpu: ROOT, PCIE1: socket({ disabled: true }) } } };

export const TargetCard: Story = { args: { nodes: { root_cpu: ROOT, PCIE1: socket() }, selected: "devices/gpu.toml" } };

export const Branches: Story = {
  args: {
    nodes: {
      root_cpu: ROOT,
      mux_a: { kind: "mux", parent: "root_cpu", mode: 0 },
      PCIE1: socket({ parent: "mux_a", device: "devices/gpu.toml", needs: { generation: 4, lanes: 16 } }),
      PCIE2: socket({ parent: "mux_a", slot_index: 2, disabled: true }),
      bridge_a: { kind: "bridge", parent: "root_cpu", lanes: 4 },
      M2_1: socket({ parent: "bridge_a", category: "m2_slot", slot_index: null, offers: { generation: 4, lanes: 4 } }),
      M2_2: socket({
        parent: "root_cpu",
        category: "m2_slot",
        slot_index: null,
        device: "devices/ssd.toml",
        offers: { generation: 5, lanes: 4 },
        needs: { generation: 5, lanes: 4 },
      }),
    },
  },
};

export const NoBoard: Story = { args: { nodes: null } };
