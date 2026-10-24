import { describe, expect, it } from "vitest";

import { layeredLayout, NODE_H, NODE_W } from "../components/graph/layout";

const nodes = (...ids: string[]) => ids.map((id) => ({ id }));

describe("layeredLayout", () => {
  it("exposes the node box size the graph nodes render at", () => {
    expect([NODE_W, NODE_H]).toEqual([190, 62]);
  });

  it("puts the root in the first column and each hop one column to the right", () => {
    const pos = layeredLayout(
      nodes("root", "a", "b"),
      [
        { from: "root", to: "a" },
        { from: "a", to: "b" },
      ],
      "root",
    );
    expect(pos.get("root")?.x).toBe(0);
    expect(pos.get("a")?.x).toBe(260);
    expect(pos.get("b")?.x).toBe(520);
  });

  it("stacks siblings vertically, centred on the row axis", () => {
    const pos = layeredLayout(
      nodes("root", "a", "b"),
      [
        { from: "root", to: "a" },
        { from: "root", to: "b" },
      ],
      "root",
    );
    // A single node is centred on its own height; two siblings are a row gap apart.
    expect(pos.get("root")).toEqual({ x: 0, y: -31 });
    expect(pos.get("a")).toEqual({ x: 260, y: -77 });
    expect(pos.get("b")).toEqual({ x: 260, y: 15 });
  });

  it("places a node at its shortest distance from the root", () => {
    const pos = layeredLayout(
      nodes("root", "a", "b"),
      [
        { from: "root", to: "a" },
        { from: "a", to: "b" },
        { from: "root", to: "b" },
      ],
      "root",
    );
    expect(pos.get("b")?.x).toBe(260);
  });

  it("terminates on cycles", () => {
    const pos = layeredLayout(
      nodes("root", "a"),
      [
        { from: "root", to: "a" },
        { from: "a", to: "root" },
      ],
      "root",
    );
    expect(pos.get("root")?.x).toBe(0);
    expect(pos.get("a")?.x).toBe(260);
  });

  it("parks unreachable nodes in the column after the deepest reachable one", () => {
    const pos = layeredLayout(nodes("root", "a", "orphan"), [{ from: "root", to: "a" }], "root");
    expect(pos.get("orphan")?.x).toBe(520);
  });

  it("positions exactly the given nodes, ignoring edges to unknown ids", () => {
    const pos = layeredLayout(nodes("root", "a"), [{ from: "root", to: "ghost" }], "root");
    expect([...pos.keys()].sort()).toEqual(["a", "root"]);
  });
});
