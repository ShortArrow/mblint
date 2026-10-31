import { describe, expect, it } from "vitest";
import type { LayoutNode } from "./report/LayoutNode";
import { bracket } from "./tree";

const socket = (parent: string, slot_index: number | null = null): LayoutNode => ({
  kind: "socket",
  parent,
  category: "pcie_slot",
  slot_index,
  device: null,
  disabled: false,
  offers: null,
  needs: null,
});

describe("bracket", () => {
  const layout: Record<string, LayoutNode> = {
    root_b: { kind: "root", parent: null, generation: 4, supplied: 4, demanded: 0 },
    root_a: { kind: "root", parent: null, generation: 5, supplied: 16, demanded: 16 },
    mux: { kind: "mux", parent: "root_a", mode: 0 },
    PCIE_FAR: socket("mux", 5),
    PCIE_NEAR: socket("mux", 2),
    M2_1: socket("root_a"),
    ctrl: { kind: "controller", parent: null },
    USB_C1: socket("unknown"),
  };

  it("roots each tree at a root, in id order, without controllers", () => {
    expect(bracket(layout).roots.map((tree) => tree.id)).toEqual(["root_a", "root_b"]);
  });

  it("orders children by slot position, then id, with sockets of unknown parent apart", () => {
    const [rootA] = bracket(layout).roots;

    expect(rootA!.children.map((child) => child.id)).toEqual(["M2_1", "mux"]);
    expect(rootA!.children[1]!.children.map((child) => child.id)).toEqual(["PCIE_NEAR", "PCIE_FAR"]);
    expect(bracket(layout).unknown.map((tree) => tree.id)).toEqual(["USB_C1"]);
  });
});
