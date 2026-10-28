import { describe, expect, it } from "vitest";

import type { RelationGraph } from "../api/relationships";
import { graphModel, NODE_W, usersetRelation } from "../components/rebac/graph-model";

const node = (id: string) => ({ id, type: id.split(":")[0] ?? "", label: id.split(":")[1] ?? "" });

// document:readme#viewer as the seeded Qeet Group has it (cmd/seed policies.go), shortened.
const graph: RelationGraph = {
  nodes: [
    "document:readme",
    "folder:handbook",
    "group:pm",
    "user:grace",
    "group:engineering",
    "group:sre",
    "user:a",
    "user:b",
    "user:c",
  ].map(node),
  edges: [
    { from: "document:readme", to: "folder:handbook", relation: "viewer → viewer" },
    { from: "document:readme", to: "group:pm", relation: "viewer → member" },
    { from: "document:readme", to: "user:grace", relation: "viewer" },
    { from: "folder:handbook", to: "group:engineering", relation: "viewer → member" },
    { from: "group:engineering", to: "group:sre", relation: "member → member" },
    { from: "group:pm", to: "user:a", relation: "member" },
    { from: "group:sre", to: "user:b", relation: "member" },
    { from: "group:sre", to: "user:c", relation: "member" },
  ],
};

describe("the relationship graph", () => {
  const model = graphModel(graph, "document:readme");

  it("folds people into the group that names them, and draws people on the object", () => {
    expect([...model.nodes.keys()]).not.toContain("user:a");
    expect(model.nodes.get("group:pm")?.people).toEqual(["user:a"]);
    expect(model.nodes.get("group:sre")?.people).toEqual(["user:b", "user:c"]);
    expect(model.nodes.get("user:grace")?.kind).toBe("user");
    expect(model.people.size).toBe(4);
  });

  it("puts each node under the one it was first reached through, a layer each hop", () => {
    expect(model.nodes.get("document:readme")?.depth).toBe(0);
    expect(model.nodes.get("group:sre")?.depth).toBe(3);
    const root = model.nodes.get("document:readme");
    const kids = (root?.children ?? []).map((id) => model.nodes.get(id)?.x ?? 0);
    // The root sits centred over what it reaches.
    expect(root?.x).toBeCloseTo(((kids[0] ?? 0) + (kids.at(-1) ?? 0)) / 2);
    expect(model.width).toBeGreaterThanOrEqual(3 * NODE_W);
  });

  it("knows the hops from the object to any node, and the relation to open it with", () => {
    expect(model.pathTo("user:b").map((h) => `${h.object}#${h.relation} ${h.subject}`)).toEqual([
      "document:readme#viewer folder:handbook#viewer",
      "folder:handbook#viewer group:engineering#member",
      "group:engineering#member group:sre#member",
      "group:sre#member user:b",
    ]);
    expect(usersetRelation(model, "folder:handbook")).toBe("viewer");
    expect(usersetRelation(model, "user:grace")).toBeUndefined();
  });
});
