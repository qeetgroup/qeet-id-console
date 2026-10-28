import { describe, expect, it } from "vitest";

import type { AbacPolicy, CondNode } from "../api/abac";
import {
  addNode,
  draftFromPolicy,
  draftProblem,
  findNode,
  isAlways,
  newDraft,
  parentOf,
  removeNode,
  toInput,
  unwrapNot,
  wrapInNot,
} from "../components/abac/policy-draft";
import { conditionAttributes, matchesSearch } from "../components/abac/policy-list";
import { sampleRequest } from "../components/abac/policy-test";

const policy = (over: Partial<AbacPolicy> = {}): AbacPolicy => ({
  id: "p-1",
  tenant_id: "t-1",
  name: "Contractors: business hours only",
  description: "",
  effect: "deny",
  resource_type: "*",
  action: "*",
  condition: {
    all: [
      { attr: "subject.employment_type", op: "eq", value: "contractor" },
      {
        any: [
          { attr: "context.hour", op: "lt", value: 8 },
          { attr: "context.weekday", op: "in", value: ["Sat", "Sun"] },
        ],
      },
    ],
  },
  priority: 600,
  enabled: true,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  ...over,
});

const leaf = (attr: string): CondNode => ({ id: attr, kind: "leaf", attr, op: "eq", value: "x" });

describe("a policy with no condition", () => {
  it("reads null and the empty object {} as Always", () => {
    expect(isAlways(null)).toBe(true);
    expect(isAlways({} as never)).toBe(true);
    expect(isAlways({ attr: "subject.a", op: "eq", value: 1 })).toBe(false);
    // The seeded handbook policy stores {}: it opens as Always, not as a blank condition.
    expect(draftFromPolicy(policy({ condition: {} as never })).condition).toBeNull();
  });

  it("saves Always as no condition", () => {
    const d = { ...draftFromPolicy(policy()), condition: null };
    expect(toInput(d).condition).toBeNull();
  });
});

describe("the condition tree's edits", () => {
  const root: CondNode = {
    id: "g",
    kind: "group",
    combinator: "all",
    children: [leaf("a"), { id: "n", kind: "not", child: leaf("b") }],
  };

  it("finds nodes and their parents", () => {
    expect(findNode(root, "b")?.id).toBe("b");
    expect(parentOf(root, "b")?.id).toBe("n");
    expect(parentOf(root, "n")?.id).toBe("g");
    expect(parentOf(root, "g")).toBeNull();
  });

  it("removes a node, and a Not left holding nothing", () => {
    const next = removeNode(root, "b");
    expect(next && next.kind === "group" && next.children.map((c) => c.id)).toEqual(["a"]);
    expect(removeNode(root, "g")).toBeNull();
  });

  it("adds to the top: a lone condition becomes an All group with the new one", () => {
    const added = addNode(leaf("a"), leaf("c"));
    expect(added.kind === "group" && added.combinator).toBe("all");
    expect(added.kind === "group" && added.children.map((c) => c.id)).toEqual(["a", "c"]);
    expect(addNode(null, leaf("c")).kind).toBe("group");
  });

  it("wraps a node in a Not and takes it out again", () => {
    const wrapped = wrapInNot(root, "a");
    const not = parentOf(wrapped, "a");
    expect(not?.kind).toBe("not");
    if (!not) throw new Error("no Not");
    expect(parentOf(unwrapNot(wrapped, not.id), "a")?.id).toBe("g");
  });
});

describe("saving a draft", () => {
  it("a new policy can't be saved until its condition names an attribute", () => {
    const d = newDraft();
    expect(draftProblem(d)).toEqual({ code: "needsAttribute" });
    const leaf: CondNode = {
      id: "l",
      kind: "leaf",
      attr: "subject.department",
      op: "eq",
      value: "x",
    };
    const named = { ...d, condition: addNode(null, leaf) };
    expect(draftProblem(named)).toBeNull();
  });

  it("a template's role block blocks saving", () => {
    expect(draftProblem({ ...newDraft(), condition: null, requireRole: "admin" })).toEqual({
      code: "mixedEngines",
    });
  });

  it("sends a blank target as * and the condition in its stored form", () => {
    const d = { ...draftFromPolicy(policy()), resourceType: " ", action: "" };
    const input = toInput(d);
    expect(input.resource_type).toBe("*");
    expect(input.action).toBe("*");
    expect(input.condition).toEqual(policy().condition);
  });
});

describe("the policy list and its test", () => {
  it("collects every attribute a condition names, and searches by them", () => {
    expect(conditionAttributes(policy().condition)).toEqual([
      "subject.employment_type",
      "context.hour",
      "context.weekday",
    ]);
    expect(matchesSearch(policy(), "weekday")).toBe(true);
    expect(matchesSearch(policy(), "mfa")).toBe(false);
  });

  it("starts the test from the attributes the policy compares", () => {
    const request = JSON.parse(sampleRequest(draftFromPolicy(policy())));
    expect(request.subject).toEqual({ employment_type: "contractor" });
    expect(request.context).toEqual({ hour: 8, weekday: "Sat" });
    expect(request.resource.type).toBe("document");
    expect(request.action).toBe("read");
  });
});
