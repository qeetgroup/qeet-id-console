export const NODE_W = 190;
export const NODE_H = 62;
const LAYER_GAP_X = 260;
const ROW_GAP_Y = 92;

export interface XY {
  x: number;
  y: number;
}

/**
 * Returns absolute positions for a left-to-right layered layout: the root in the first column,
 * each hop one column right, siblings stacked. Nodes the root can't reach go in a last column.
 */
export function layeredLayout(
  nodes: { id: string }[],
  edges: { from: string; to: string }[],
  rootId: string,
): Map<string, XY> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const out = adj.get(e.from);
    if (out) out.push(e.to);
    else adj.set(e.from, [e.to]);
  }

  const layer = new Map<string, number>();
  const queue: string[] = [];
  if (nodes.some((n) => n.id === rootId)) {
    layer.set(rootId, 0);
    queue.push(rootId);
  }
  for (let cur = queue.shift(); cur !== undefined; cur = queue.shift()) {
    // Every queued id had its layer set before it was pushed, so the fallback never applies.
    const cl = layer.get(cur) ?? 0;
    for (const nxt of adj.get(cur) ?? []) {
      if (!layer.has(nxt)) {
        layer.set(nxt, cl + 1);
        queue.push(nxt);
      }
    }
  }
  const maxLayer = layer.size ? Math.max(...layer.values()) : 0;
  for (const n of nodes) if (!layer.has(n.id)) layer.set(n.id, maxLayer + 1);

  const byLayer = new Map<number, string[]>();
  for (const n of nodes) {
    const l = layer.get(n.id) ?? 0;
    const ids = byLayer.get(l);
    if (ids) ids.push(n.id);
    else byLayer.set(l, [n.id]);
  }

  const pos = new Map<string, XY>();
  for (const [l, ids] of byLayer) {
    const totalH = ids.length * NODE_H + (ids.length - 1) * (ROW_GAP_Y - NODE_H);
    const startY = -totalH / 2;
    ids.forEach((id, i) => {
      pos.set(id, { x: l * LAYER_GAP_X, y: startY + i * ROW_GAP_Y });
    });
  }
  return pos;
}
