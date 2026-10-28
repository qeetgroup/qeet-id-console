// The relationship graph as something to read: GET /relation-tuples/graph returns every node and
// edge reachable from object#relation (rebac.go expand: breadth first, each object#relation once).
// This draws it as a tree from the object, each node under the one it was first reached through,
// and folds people into the group or folder that names them, so 26 people read as a few groups.

import type { GraphEdge, RelationGraph } from "@/modules/authorization/api/relationships";

export const NODE_W = 136;
export const NODE_H = 60;
const GAP_X = 12;
const GAP_Y = 44;
/** At most this many people directly on the object are drawn; the rest fold into one node. */
const DIRECT_PEOPLE = 4;

export type NodeKind = "object" | "user" | "people";

export interface DrawnNode {
  id: string; // "type:id"; a fold of people is "people:<parent>"
  type: string; // the type part ("document", "group"), or "people"
  label: string; // the id part
  kind: NodeKind;
  /** The people a group, folder or object names directly, folded into it. */
  people: string[];
  /** The objects a node names directly that are drawn under it. */
  children: string[];
  depth: number;
  x: number;
  y: number;
}

export interface Hop {
  object: string; // "type:id"
  relation: string; // the relation held on it ("viewer")
  subject: string; // the node it names: "group:eng#member", or "user:<id>"
}

export interface GraphModel {
  root: string;
  nodes: Map<string, DrawnNode>;
  /** Drawn edges, each parent to child, with the relation expanded on the parent. */
  edges: { from: string; to: string; relation: string }[];
  width: number;
  height: number;
  /** Everyone who reaches the root, each with the hops of their first way in. */
  people: Map<string, Hop[]>;
  /** The hops from the root to a node (empty for the root). */
  pathTo: (id: string) => Hop[];
  /** The other nodes that also name this one, beyond the one it is drawn under. */
  alsoFrom: (id: string) => string[];
}

const isUser = (id: string) => id.startsWith("user:");

// "viewer → member" names the relation on the parent, then the userset's on the child.
function split(relation: string): { on: string; userset?: string } {
  const [on = relation, userset] = relation.split(" → ");
  return { on, userset };
}

function subjectOf(edge: GraphEdge): string {
  const { userset } = split(edge.relation);
  return userset ? `${edge.to}#${userset}` : edge.to;
}

/** Builds the tree from `root` and lays it out top down, the root centred over what it reaches. */
export function graphModel(graph: RelationGraph, root: string): GraphModel {
  const out = new Map<string, GraphEdge[]>();
  for (const e of graph.edges) out.set(e.from, [...(out.get(e.from) ?? []), e]);
  const label = new Map(graph.nodes.map((n) => [n.id, { type: n.type, label: n.label }]));

  // First reach, breadth first: each node's parent edge on its fewest hops.
  const parent = new Map<string, GraphEdge>();
  const depth = new Map<string, number>([[root, 0]]);
  const order: string[] = [root];
  for (let i = 0; i < order.length; i++) {
    const cur = order[i] ?? root;
    for (const e of out.get(cur) ?? []) {
      if (depth.has(e.to)) continue;
      depth.set(e.to, (depth.get(cur) ?? 0) + 1);
      parent.set(e.to, e);
      order.push(e.to);
    }
  }

  const pathTo = (id: string): Hop[] => {
    const hops: Hop[] = [];
    for (let at = id, e = parent.get(at); e; at = e.from, e = parent.get(at)) {
      hops.unshift({ object: e.from, relation: split(e.relation).on, subject: subjectOf(e) });
    }
    return hops;
  };

  const nodes = new Map<string, DrawnNode>();
  const make = (id: string, kind: NodeKind, d: number): DrawnNode => {
    const known = label.get(id);
    const node: DrawnNode = {
      id,
      type: kind === "people" ? "people" : (known?.type ?? id.split(":")[0] ?? ""),
      label: known?.label ?? id.slice(id.indexOf(":") + 1),
      kind,
      people: [],
      children: [],
      depth: d,
      x: 0,
      y: 0,
    };
    nodes.set(id, node);
    return node;
  };
  make(root, "object", 0);
  const people = new Map<string, Hop[]>();
  for (const id of order.slice(1)) {
    const e = parent.get(id);
    if (!e) continue;
    const from = nodes.get(e.from);
    if (!from) continue;
    if (isUser(id)) {
      people.set(id, pathTo(id));
      // People on the root are drawn, a few of them; deeper ones fold into what names them.
      const direct = from.id === root && from.children.filter(isUser).length < DIRECT_PEOPLE;
      if (direct) {
        make(id, "user", from.depth + 1);
        from.children.push(id);
      } else from.people.push(id);
      continue;
    }
    make(id, "object", from.depth + 1);
    from.children.push(id);
  }
  // The root's people beyond the few drawn: one node for the rest.
  const rootNode = nodes.get(root);
  if (rootNode?.people.length) {
    const fold = make(`people:${root}`, "people", 1);
    fold.people = rootNode.people;
    rootNode.people = [];
    rootNode.children.push(fold.id);
  }

  // Each subtree as wide as its leaves; a parent centred over its children.
  const slots = new Map<string, number>();
  const width = (id: string): number => {
    const n = nodes.get(id);
    const w = n?.children.length ? n.children.reduce((s, c) => s + width(c), 0) : 1;
    slots.set(id, w);
    return w;
  };
  const total = width(root);
  let maxDepth = 0;
  const place = (id: string, left: number) => {
    const n = nodes.get(id);
    if (!n) return;
    const w = slots.get(id) ?? 1;
    n.x = (left + w / 2) * (NODE_W + GAP_X) - (NODE_W + GAP_X) / 2;
    n.y = n.depth * (NODE_H + GAP_Y);
    maxDepth = Math.max(maxDepth, n.depth);
    let at = left;
    for (const c of n.children) {
      place(c, at);
      at += slots.get(c) ?? 1;
    }
  };
  place(root, 0);

  const edges: GraphModel["edges"] = [];
  for (const n of nodes.values())
    for (const c of n.children) {
      const e = parent.get(c);
      edges.push({ from: n.id, to: c, relation: e ? split(e.relation).on : "" });
    }
  const alsoFrom = (id: string) =>
    graph.edges.filter((e) => e.to === id && e.from !== parent.get(id)?.from).map((e) => e.from);

  return {
    root,
    nodes,
    edges,
    width: total * (NODE_W + GAP_X) - GAP_X,
    height: (maxDepth + 1) * (NODE_H + GAP_Y) - GAP_Y,
    people,
    pathTo,
    alsoFrom,
  };
}

/** The relation a node is reached with, to open it in turn ("member" for group:eng#member). */
export function usersetRelation(model: GraphModel, id: string): string | undefined {
  const last = model.pathTo(id).at(-1);
  const hash = last?.subject.lastIndexOf("#") ?? -1;
  return last && hash > 0 ? last.subject.slice(hash + 1) : undefined;
}
