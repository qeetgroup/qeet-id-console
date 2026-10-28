import { describe, expect, it } from "vitest";

import type { Group } from "../api/groups";
import {
  describedAs,
  everyGroup,
  foldable,
  grantsToNoOne,
  groupTree,
  groupsListSearch,
  isFlat,
  pageOf,
  sizeOf,
  visibleGroups,
} from "../groups-model";

const group = (
  id: string,
  name: string,
  member_count: number,
  parent_id: string | null = null,
  description = "",
): Group => ({
  id,
  tenant_id: "t1",
  parent_id,
  name,
  description,
  created_at: `2025-08-${String(10 + id.length).padStart(2, "0")}T10:00:00Z`,
  member_count,
});

const GROUPS = [
  group("eng", "Engineering", 1, null, "Everyone in Engineering"),
  group("pay", "Payments", 5, "eng", "Engineering — Payments"),
  group("sre", "Site Reliability", 6, "eng", "Keeps production up"),
  group("core", "Core", 2, "sre"),
  group("sales", "Sales", 0, null),
  group("part", "Partnerships", 0, "sales"),
  group("grc", "Governance", 0, null),
];
const ROLES = new Map<string, string[]>([
  ["eng", []],
  ["pay", []],
  ["sre", ["Developer"]],
  ["core", []],
  ["sales", []],
  ["part", []],
  ["grc", ["Auditor"]],
]);
const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe("groupTree", () => {
  it("nests groups by parent, each level by name, with depth, path and the people each covers", () => {
    const roots = groupTree(GROUPS);
    expect(names(roots)).toEqual(["Engineering", "Governance", "Sales"]);
    const all = everyGroup(roots);
    expect(names(all)).toEqual([
      "Engineering",
      "Payments",
      "Site Reliability",
      "Core",
      "Governance",
      "Sales",
      "Partnerships",
    ]);
    const core = all.find((g) => g.id === "core");
    expect(core).toMatchObject({ depth: 2, path: ["Engineering", "Site Reliability"] });
    const eng = all.find((g) => g.id === "eng");
    expect(eng).toMatchObject({ people: 14, inside: 3 });
    expect(foldable(roots)).toEqual(["eng", "sre", "sales"]);
  });

  it("puts a group whose parent is missing, or itself, at the top", () => {
    const roots = groupTree([group("a", "Orphan", 1, "gone"), group("b", "Self", 1, "b")]);
    expect(names(roots)).toEqual(["Orphan", "Self"]);
  });
});

describe("sizes and looks", () => {
  it("sizes a group by the people it covers", () => {
    expect([0, 1, 5, 6, 20, 21].map(sizeOf)).toEqual([
      "empty",
      "one",
      "few",
      "team",
      "team",
      "large",
    ]);
  });

  it("finds roles granted to no one: roles reach only a group's own members", () => {
    const all = everyGroup(groupTree(GROUPS));
    expect(all.filter((g) => grantsToNoOne(g, ROLES)).map((g) => g.id)).toEqual(["grc"]);
  });

  it("drops a description that only repeats the name or path", () => {
    const all = everyGroup(groupTree(GROUPS));
    const line = (id: string) => describedAs(all.find((g) => g.id === id) as never);
    expect(line("eng")).toBeNull();
    expect(line("pay")).toBeNull();
    expect(line("sre")).toBe("Keeps production up");
  });
});

describe("visibleGroups", () => {
  const roots = groupTree(GROUPS);

  it("shows the tree with the open families open, and folded ones folded", () => {
    expect(names(visibleGroups(roots, {}, new Set(["eng"]), ROLES, null))).toEqual([
      "Engineering",
      "Payments",
      "Site Reliability",
      "Governance",
      "Sales",
    ]);
  });

  it("lists matches flat for a search or filter, and keeps to one family with `inside`", () => {
    expect(isFlat({ inside: "eng" })).toBe(false);
    expect(isFlat({ q: "pay" })).toBe(true);
    expect(names(visibleGroups(roots, { q: "co" }, new Set(), ROLES, null))).toEqual(["Core"]);
    expect(names(visibleGroups(roots, { look: "empty" }, new Set(), ROLES, null))).toEqual([
      "Governance",
      "Partnerships",
      "Sales",
    ]);
    expect(names(visibleGroups(roots, { role: "Auditor" }, new Set(), ROLES, null))).toEqual([
      "Governance",
    ]);
    expect(names(visibleGroups(roots, { grants: "some" }, new Set(), ROLES, null))).toEqual([
      "Governance",
      "Site Reliability",
    ]);
    expect(names(visibleGroups(roots, { inside: "eng" }, new Set(["eng"]), ROLES, null))).toEqual([
      "Engineering",
      "Payments",
      "Site Reliability",
    ]);
    expect(
      names(visibleGroups(roots, { inside: "eng", size: "few" }, new Set(), ROLES, null)),
    ).toEqual(["Core", "Payments"]);
  });

  it("sorts each level of the tree, and the flat list as a whole", () => {
    const bySize = { column: "members", direction: "descending" } as const;
    expect(names(visibleGroups(roots, {}, new Set(["eng"]), ROLES, bySize)).slice(0, 3)).toEqual([
      "Engineering",
      "Site Reliability",
      "Payments",
    ]);
    expect(names(visibleGroups(roots, { size: "few" }, new Set(), ROLES, bySize))).toEqual([
      "Payments",
      "Core",
    ]);
  });
});

describe("pageOf", () => {
  it("marks a family's first row on a later page, so its path comes with it", () => {
    const roots = groupTree(GROUPS);
    const rows = visibleGroups(roots, {}, new Set(foldable(roots)), ROLES, null);
    const second = pageOf(rows, 2, 2, false);
    expect(second.map((r) => [r.name, !!r.continued])).toEqual([
      ["Site Reliability", true],
      ["Core", false],
    ]);
    expect(pageOf(rows, 0, 2, false)[0]?.continued).toBeUndefined();
    expect(pageOf(rows, 2, 2, true)[0]?.continued).toBeUndefined();
  });
});

describe("groupsListSearch", () => {
  it("keeps the list's filters and drops what it doesn't know", () => {
    expect(
      groupsListSearch.parse({ q: "pay", size: "huge", grants: "some", look: "empty", x: "1" }),
    ).toEqual({ q: "pay", size: undefined, grants: "some", look: "empty" });
  });
});
