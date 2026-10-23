import { describe, expect, it } from "vitest";

import {
  type CondNode,
  type ConditionJson,
  countLeaves,
  emptyGroup,
  emptyLeaf,
  fromConditionJson,
  LIST_OPERATORS,
  NULLARY_OPERATORS,
  nid,
  OPERATOR_LABELS,
  OPERATORS,
  type Operator,
  toConditionJson,
} from "../api/abac";

function leaf(attr: string, op: Operator, value = ""): CondNode {
  return { id: nid("leaf"), kind: "leaf", attr, op, value };
}

function group(combinator: "all" | "any", children: CondNode[]): CondNode {
  return { id: nid("grp"), kind: "group", combinator, children };
}

describe("operator catalogue", () => {
  it("labels every operator the condition builder offers", () => {
    for (const op of OPERATORS) expect(OPERATOR_LABELS[op]).toBeTruthy();
    expect(OPERATORS).toHaveLength(13);
  });

  it("treats only 'exists' as valueless and only in/nin as lists", () => {
    expect(NULLARY_OPERATORS).toEqual(["exists"]);
    expect(LIST_OPERATORS).toEqual(["in", "nin"]);
  });
});

describe("nid", () => {
  it("prefixes ids and never repeats them", () => {
    const ids = Array.from({ length: 50 }, () => nid("leaf"));
    expect(ids.every((id) => id.startsWith("leaf_"))).toBe(true);
    expect(new Set(ids).size).toBe(50);
  });
});

describe("emptyLeaf / emptyGroup", () => {
  it("starts a leaf in the subject namespace with an equals comparison", () => {
    expect(emptyLeaf()).toMatchObject({ kind: "leaf", attr: "subject.", op: "eq", value: "" });
  });

  it("starts a group with one blank leaf to edit, defaulting to ALL", () => {
    const g = emptyGroup();
    expect(g).toMatchObject({ kind: "group", combinator: "all" });
    expect(g.kind === "group" ? g.children : []).toHaveLength(1);
    expect(emptyGroup("any")).toMatchObject({ kind: "group", combinator: "any" });
  });
});

describe("toConditionJson", () => {
  it("serialises ALL / ANY groups and NOT wrappers into the backend tree", () => {
    const tree: CondNode = group("all", [
      leaf("subject.dept", "eq", "eng"),
      group("any", [leaf("context.network", "eq", "corp")]),
      { id: nid("not"), kind: "not", child: leaf("subject.suspended", "exists") },
    ]);

    expect(toConditionJson(tree)).toEqual({
      all: [
        { attr: "subject.dept", op: "eq", value: "eng" },
        { any: [{ attr: "context.network", op: "eq", value: "corp" }] },
        { not: { attr: "subject.suspended", op: "exists" } },
      ],
    });
  });

  it("keeps numbers and booleans typed and trims the raw input", () => {
    expect(toConditionJson(leaf("context.hour", "lt", " 9 "))).toEqual({
      attr: "context.hour",
      op: "lt",
      value: 9,
    });
    expect(toConditionJson(leaf("context.mfa", "eq", "true"))).toEqual({
      attr: "context.mfa",
      op: "eq",
      value: true,
    });
    expect(toConditionJson(leaf("context.mfa", "eq", "false"))).toEqual({
      attr: "context.mfa",
      op: "eq",
      value: false,
    });
    expect(toConditionJson(leaf("subject.dept", "eq", "  eng  "))).toEqual({
      attr: "subject.dept",
      op: "eq",
      value: "eng",
    });
  });

  it.each([
    ["a zero-padded code", "02134"],
    ["exponent notation", "1e3"],
    ["a trailing zero", "1.50"],
    ["hex notation", "0x10"],
    ["a leading plus", "+7"],
    ["a leading dot", ".5"],
    ["negative zero", "-0"],
    ["Infinity", "Infinity"],
    ["NaN", "NaN"],
  ])("keeps %s as the string the admin typed", (_label, raw) => {
    expect(toConditionJson(leaf("subject.postcode", "eq", raw))).toEqual({
      attr: "subject.postcode",
      op: "eq",
      value: raw,
    });
  });

  it("still types canonical numerals, including negatives and decimals", () => {
    for (const [raw, n] of [
      ["0", 0],
      ["-3", -3],
      ["1.5", 1.5],
      ["2134", 2134],
    ] as const) {
      expect(toConditionJson(leaf("context.n", "eq", raw))).toMatchObject({ value: n });
    }
    expect(toConditionJson(leaf("subject.zip", "in", "02134, 2134"))).toMatchObject({
      value: ["02134", 2134],
    });
  });

  it("keeps a blank value as an empty string rather than coercing it to 0", () => {
    expect(toConditionJson(leaf("subject.dept", "eq", "   "))).toEqual({
      attr: "subject.dept",
      op: "eq",
      value: "",
    });
  });

  it("drops the value entirely for 'exists', even when one was typed", () => {
    expect(toConditionJson(leaf("subject.email", "exists", "ignored"))).toEqual({
      attr: "subject.email",
      op: "exists",
    });
  });

  it("splits in / nin values on commas, coercing each item and dropping blanks", () => {
    expect(toConditionJson(leaf("subject.role", "in", "admin, owner, ,3,true"))).toEqual({
      attr: "subject.role",
      op: "in",
      value: ["admin", "owner", 3, true],
    });
    expect(toConditionJson(leaf("subject.role", "nin", ""))).toEqual({
      attr: "subject.role",
      op: "nin",
      value: [],
    });
  });

  it("serialises an empty group as an empty array (which the backend treats as ALL=true / ANY=false)", () => {
    expect(toConditionJson(group("all", []))).toEqual({ all: [] });
    expect(toConditionJson(group("any", []))).toEqual({ any: [] });
  });
});

describe("fromConditionJson", () => {
  it("opens a blank ALL group when the policy has no condition", () => {
    for (const json of [null, undefined]) {
      const node = fromConditionJson(json);
      expect(node).toMatchObject({ kind: "group", combinator: "all" });
      expect(node.kind === "group" ? node.children : []).toEqual([
        expect.objectContaining({ kind: "leaf", attr: "subject.", op: "eq", value: "" }),
      ]);
    }
  });

  it("gives an empty group a placeholder leaf so there is something to edit", () => {
    const node = fromConditionJson({ any: [] });
    expect(node).toMatchObject({ kind: "group", combinator: "any" });
    expect(node.kind === "group" ? node.children.length : 0).toBe(1);
  });

  it("renders leaf values as editable text", () => {
    expect(
      fromConditionJson({ attr: "subject.role", op: "in", value: ["a", "b", 3] }),
    ).toMatchObject({ kind: "leaf", value: "a, b, 3" });
    expect(fromConditionJson({ attr: "context.hour", op: "lt", value: 9 })).toMatchObject({
      value: "9",
    });
    expect(fromConditionJson({ attr: "context.mfa", op: "eq", value: true })).toMatchObject({
      value: "true",
    });
    expect(fromConditionJson({ attr: "subject.email", op: "exists" })).toMatchObject({
      value: "",
    });
    expect(fromConditionJson({ attr: "subject.x", op: "eq", value: null })).toMatchObject({
      value: "",
    });
  });

  it("gives every node in the parsed tree a distinct id", () => {
    const node = fromConditionJson({
      all: [{ attr: "a.b", op: "eq", value: 1 }, { not: { attr: "c.d", op: "exists" } }],
    });
    const ids: string[] = [];
    const walk = (n: CondNode) => {
      ids.push(n.id);
      if (n.kind === "group") n.children.forEach(walk);
      if (n.kind === "not") walk(n.child);
    };
    walk(node);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });

  it("round-trips a typed backend tree through the editor unchanged", () => {
    const json: ConditionJson = {
      all: [
        { attr: "subject.dept", op: "eq", value: "eng" },
        {
          any: [
            { attr: "context.hour_of_day", op: "lt", value: 9 },
            { not: { attr: "subject.suspended", op: "exists" } },
          ],
        },
        { attr: "subject.role", op: "in", value: ["admin", "owner"] },
        { attr: "context.mfa", op: "ne", value: true },
      ],
    };
    expect(toConditionJson(fromConditionJson(json))).toEqual(json);
  });
});

describe("countLeaves", () => {
  it("counts comparison leaves through groups and NOT wrappers", () => {
    const tree = group("all", [
      leaf("a.a", "eq", "1"),
      group("any", [leaf("b.b", "eq", "2"), leaf("c.c", "eq", "3")]),
      { id: nid("not"), kind: "not", child: leaf("d.d", "exists") },
    ]);
    expect(countLeaves(tree)).toBe(4);
    expect(countLeaves(group("all", []))).toBe(0);
    expect(countLeaves(leaf("a.a", "eq"))).toBe(1);
  });
});
