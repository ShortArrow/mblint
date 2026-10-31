import type { LayoutNode } from "./report/LayoutNode";

/** A node of the bracket with its children in drawing order. */
export type TreeNode = { id: string; node: LayoutNode; children: TreeNode[] };

type Root = Extract<LayoutNode, { kind: "root" }>;

/**
 * The layout as brackets, one per root, and the sockets whose parent is `unknown` or not a node.
 * Roots are ordered by generation, then by lanes supplied, highest first, then by id. Children
 * are ordered by slot position, then by id; controllers are left out.
 */
export function bracket(layout: Record<string, LayoutNode>): { roots: TreeNode[]; unknown: TreeNode[] } {
  const children = new Map<string, string[]>();
  const unknown: string[] = [];
  for (const [id, node] of Object.entries(layout)) {
    if (node.kind === "root" || node.kind === "controller" || node.parent === null) continue;
    if (node.parent in layout) {
      children.set(node.parent, [...(children.get(node.parent) ?? []), id]);
    } else if (node.kind === "socket") {
      unknown.push(id);
    }
  }
  const order = (ids: string[]) =>
    [...ids].sort((a, b) => {
      const [left, right] = [slotIndex(layout[a]!), slotIndex(layout[b]!)];
      if (left !== right) return left < right ? -1 : 1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
  const grow = (id: string): TreeNode => ({
    id,
    node: layout[id]!,
    children: order(children.get(id) ?? []).map(grow),
  });
  const roots = Object.entries(layout)
    .flatMap(([id, node]): [string, Root][] => (node.kind === "root" ? [[id, node]] : []))
    .sort(
      ([a, left], [b, right]) =>
        right.generation - left.generation || right.supplied - left.supplied || (a < b ? -1 : a > b ? 1 : 0),
    )
    .map(([id]) => id);
  return { roots: roots.map(grow), unknown: order(unknown).map(grow) };
}

function slotIndex(node: LayoutNode): number {
  return node.kind === "socket" && node.slot_index !== null ? node.slot_index : Number.POSITIVE_INFINITY;
}
