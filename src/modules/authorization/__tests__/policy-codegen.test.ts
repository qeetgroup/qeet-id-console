import { assert, describe, expect, it } from "vitest";

import i18n from "@/i18n";
import { type CondNode, nid, type Operator } from "../api/abac";
import { policyProblemMessage } from "../components/condition-builder/condition-problem";
import {
  abacSaveBlocker,
  type EvalTreeNode,
  emptyPolicyDoc,
  isReducibleToAbac,
  type PolicyDoc,
  toAbacInput,
  toDsl,
  toEvalTree,
  toJson,
  toJsonObject,
  toYaml,
  toYamlDoc,
} from "../utils/policy-codegen";

function leaf(attr: string, op: Operator, value = ""): CondNode {
  return { id: nid("leaf"), kind: "leaf", attr, op, value };
}
function compare(attr: string, op: Operator, other: string): CondNode {
  return { id: nid("leaf"), kind: "leaf", attr, op, value: other, ref: true };
}
function all(children: CondNode[]): CondNode {
  return { id: nid("grp"), kind: "group", combinator: "all", children };
}
function any(children: CondNode[]): CondNode {
  return { id: nid("grp"), kind: "group", combinator: "any", children };
}
function not(child: CondNode): CondNode {
  return { id: nid("not"), kind: "not", child };
}

function doc(overrides: Partial<PolicyDoc> = {}): PolicyDoc {
  return {
    name: "hr_view",
    description: "HR reads profiles",
    effect: "allow",
    resourceType: "employee_profile",
    action: "read",
    requireRole: null,
    condition: null,
    relation: null,
    priority: 30,
    enabled: true,
    ...overrides,
  };
}

describe("emptyPolicyDoc", () => {
  it("starts an enabled allow policy with one blank ALL condition and no RBAC/ReBAC block", () => {
    const d = emptyPolicyDoc();
    expect(d).toMatchObject({
      name: "",
      description: "",
      effect: "allow",
      resourceType: "",
      action: "",
      requireRole: null,
      relation: null,
      priority: 10,
      enabled: true,
    });
    expect(d.condition).toMatchObject({ kind: "group", combinator: "all" });
    expect(isReducibleToAbac(d)).toBe(true);
  });
});

describe("isReducibleToAbac", () => {
  it("is persistable as ABAC only without an RBAC role or ReBAC relation", () => {
    expect(isReducibleToAbac(doc({ condition: all([leaf("subject.dept", "eq", "HR")]) }))).toBe(
      true,
    );
    expect(isReducibleToAbac(doc({ requireRole: "maintainer" }))).toBe(false);
    expect(isReducibleToAbac(doc({ relation: { object: "doc:", relation: "owner" } }))).toBe(false);
  });

  it("treats an empty role name as no RBAC block", () => {
    expect(isReducibleToAbac(doc({ requireRole: "" }))).toBe(true);
  });

  it("saves a condition that compares two attributes", () => {
    for (const condition of [
      all([compare("subject.region", "eq", "resource.region")]),
      all([
        leaf("subject.role", "eq", "clinician"),
        not(compare("subject.id", "ne", "context.actor")),
      ]),
      any([compare("subject.team_ids", "contains", "resource.team_id")]),
    ]) {
      expect(abacSaveBlocker(doc({ condition }))).toBeNull();
    }
  });

  it("refuses an attribute reference the engine would reject", () => {
    const blocker = (node: CondNode) => abacSaveBlocker(doc({ condition: all([node]) }));
    expect(blocker(compare("subject.name", "regex", "resource.pattern"))).toEqual({
      code: "notReferenceable",
      op: "regex",
    });
    for (const other of ["region", "tenant.region", "resource.", "resource..id", ""]) {
      expect(blocker(compare("subject.region", "eq", other))).toEqual({
        code: "badReference",
        op: "eq",
      });
    }
    expect(blocker(compare("subject.region", "eq", "subject.region"))).toEqual({
      code: "selfReference",
      op: "eq",
    });
  });

  it("refuses an empty affix, substring or pattern, which would match everything", () => {
    for (const op of ["prefix", "suffix", "contains", "regex"] as const) {
      expect(abacSaveBlocker(doc({ condition: any([leaf("subject.email", op, "  ")]) }))).toEqual({
        code: "needsValue",
        op,
      });
    }
    expect(abacSaveBlocker(doc({ condition: all([leaf("subject.dept", "eq", "")]) }))).toBeNull();
  });

  it("compares a literal that only looks like an attribute path as a literal", () => {
    for (const value of ["resource.region", "example.com", "subject.", "v1.2"]) {
      const d = doc({ condition: all([leaf("subject.tag", "eq", value)]) });
      expect(abacSaveBlocker(d)).toBeNull();
      expect(toAbacInput(d).condition).toEqual({ all: [{ attr: "subject.tag", op: "eq", value }] });
    }
  });

  it("explains a composite RBAC/ReBAC doc with the composite reason", () => {
    expect(abacSaveBlocker(doc({ requireRole: "maintainer" }))).toEqual({ code: "mixedEngines" });
  });

  it("reads each problem in the reader's language, naming the operator at fault", () => {
    const t = i18n.getFixedT("en");
    expect(policyProblemMessage({ code: "notReferenceable", op: "regex" }, t)).toBe(
      "“matches regex” can't compare with another attribute. Compare with a value instead.",
    );
    expect(policyProblemMessage({ code: "badReference", op: "eq" }, t)).toBe(
      "The attribute to compare with must be a subject., resource. or context. path.",
    );
    expect(policyProblemMessage({ code: "selfReference", op: "eq" }, t)).toBe(
      "A condition can't compare an attribute with itself.",
    );
    expect(policyProblemMessage({ code: "needsValue", op: "prefix" }, t)).toBe(
      "“starts with” needs a value.",
    );
    expect(policyProblemMessage({ code: "mixedEngines" }, t)).toMatch(/combines RBAC\/ReBAC/);
  });
});

describe("toAbacInput", () => {
  it("maps the doc onto the backend's snake_case ABAC payload", () => {
    expect(
      toAbacInput(
        doc({ effect: "deny", condition: all([leaf("subject.dept", "eq", "HR")]), enabled: false }),
      ),
    ).toEqual({
      name: "hr_view",
      description: "HR reads profiles",
      effect: "deny",
      resource_type: "employee_profile",
      action: "read",
      condition: { all: [{ attr: "subject.dept", op: "eq", value: "HR" }] },
      priority: 30,
      enabled: false,
    });
  });

  it("widens a blank resource type or action to the '*' wildcard", () => {
    expect(toAbacInput(doc({ resourceType: "", action: "" }))).toMatchObject({
      resource_type: "*",
      action: "*",
    });
  });

  it("sends a null condition for an unconditional policy", () => {
    expect(toAbacInput(doc({ condition: null })).condition).toBeNull();
  });

  it("never sends RBAC or ReBAC blocks on the ABAC wire payload", () => {
    const input = toAbacInput(
      doc({ requireRole: "admin", relation: { object: "doc:", relation: "owner" } }),
    );
    expect(Object.keys(input).sort()).toEqual([
      "action",
      "condition",
      "description",
      "effect",
      "enabled",
      "name",
      "priority",
      "resource_type",
    ]);
  });
});

describe("toJsonObject / toJson", () => {
  it("emits fields in a stable order with placeholders for blanks", () => {
    const obj = toJsonObject(doc({ name: "", resourceType: "", action: "" }));
    expect(Object.keys(obj)).toEqual([
      "name",
      "effect",
      "resource_type",
      "action",
      "priority",
      "enabled",
      "condition",
    ]);
    expect(obj).toMatchObject({ name: "(unnamed)", resource_type: "*", action: "*" });
    expect(obj.condition).toBeNull();
  });

  it("adds rbac and rebac blocks only when the doc has them, before the condition", () => {
    const obj = toJsonObject(
      doc({
        requireRole: "maintainer",
        relation: { object: "channel:", relation: "owner" },
        condition: all([leaf("subject.org_member", "eq", "true")]),
      }),
    );
    expect(Object.keys(obj).slice(-3)).toEqual(["rbac", "rebac", "condition"]);
    expect(obj.rbac).toEqual({ require_role: "maintainer" });
    expect(obj.rebac).toEqual({ object: "channel:", relation: "owner" });
    expect(obj.condition).toEqual({ all: [{ attr: "subject.org_member", op: "eq", value: true }] });
  });

  it("pretty-prints with two-space indentation and survives hostile names", () => {
    const name = 'say "hi"\n}{ \\';
    const d = doc({ name });
    const json = toJson(d);
    expect(json.split("\n")[1]).toBe(`  "name": ${JSON.stringify(name)},`);
    expect(JSON.parse(json)).toEqual(toJsonObject(d));
  });
});

describe("toYaml", () => {
  it("leaves plain strings, numbers and booleans unquoted", () => {
    expect(toYaml({ a: "employee_profile", b: "subject.dept", c: 30, d: true, e: null })).toBe(
      "a: employee_profile\nb: subject.dept\nc: 30\nd: true\ne: null",
    );
  });

  it.each([
    ["an empty string", ""],
    ["a boolean word", "true"],
    ["a capitalised boolean word", "False"],
    ["null", "null"],
    ["a YAML 1.1 yes/no word", "yes"],
    ["a YAML 1.1 yes/no word in caps", "NO"],
    ["a tilde", "~"],
    ["an integer", "42"],
    ["a decimal", "1.5"],
    ["a colon", "a: b"],
    ["a comment marker", "# note"],
    ["a wildcard alias", "*"],
    ["a flow mapping", "{x}"],
    ["a flow sequence", "[x]"],
    ["a comma", "a,b"],
    ["an anchor", "&ref"],
    ["a leading dash", "-x"],
    ["a leading space", " lead"],
    ["a trailing space", "trail "],
    ["double quotes", 'say "hi"'],
    ["a backslash", "C:\\path"],
    ["an embedded newline", "line one\nline two"],
    ["an embedded carriage return", "a\rb"],
    ["an embedded tab", "a\tb"],
  ])("quotes and escapes %s", (_label, value) => {
    expect(toYaml({ k: value })).toBe(`k: ${JSON.stringify(value)}`);
  });

  it("keeps a multi-line value on one escaped line so the document stays valid", () => {
    const yaml = toYaml({ description: "first\nsecond", priority: 1 });
    expect(yaml).toBe('description: "first\\nsecond"\npriority: 1');
    expect(yaml.split("\n")).toHaveLength(2);
  });

  it("indents nested maps by two spaces and inlines empty collections", () => {
    expect(toYaml({ rbac: { require_role: "admin" }, tags: [], meta: {} })).toBe(
      "rbac:\n  require_role: admin\ntags: []\nmeta: {}",
    );
  });

  it("writes sequences of scalars and of maps as block sequences", () => {
    expect(toYaml({ items: ["a", 1, false] })).toBe("items:\n  - a\n  - 1\n  - false");
    expect(toYaml([{ a: 1, b: "x" }, { c: 2 }])).toBe("- a: 1\n  b: x\n- c: 2");
  });

  it("serialises bare top-level values", () => {
    expect(toYaml([])).toBe("[]");
    expect(toYaml({})).toBe("{}");
    expect(toYaml("plain")).toBe("plain");
    expect(toYaml(undefined)).toBe("null");
  });

  it("renders a policy doc as a YAML document mirroring the JSON preview", () => {
    expect(
      toYamlDoc(
        doc({
          resourceType: "",
          condition: all([
            leaf("subject.department", "eq", "HR"),
            leaf("subject.role", "in", "admin, owner"),
          ]),
        }),
      ),
    ).toBe(
      [
        "name: hr_view",
        "effect: allow",
        'resource_type: "*"',
        "action: read",
        "priority: 30",
        "enabled: true",
        "condition:",
        "  all:",
        "    - attr: subject.department",
        "      op: eq",
        "      value: HR",
        "    - attr: subject.role",
        "      op: in",
        "      value:",
        "        - admin",
        "        - owner",
      ].join("\n"),
    );
  });
});

describe("toDsl", () => {
  it("writes the header and status for an unconditional policy, with no WHEN block", () => {
    expect(toDsl(doc())).toBe(
      [
        'POLICY "hr_view"',
        "EFFECT ALLOW",
        "ON employee_profile : read",
        "PRIORITY 30",
        "STATUS enabled",
      ].join("\n"),
    );
  });

  it("falls back to placeholders for blank fields and reflects deny / disabled", () => {
    expect(
      toDsl(doc({ name: "", resourceType: "", action: "", effect: "deny", enabled: false })),
    ).toBe(
      ['POLICY "unnamed"', "EFFECT DENY", "ON * : *", "PRIORITY 30", "STATUS disabled"].join("\n"),
    );
  });

  it("parenthesises an OR condition that sits beside a role clause", () => {
    const dsl = toDsl(
      doc({
        requireRole: "maintainer",
        condition: any([leaf("subject.dept", "eq", "eng"), leaf("subject.dept", "eq", "ops")]),
      }),
    );

    expect(dsl).toContain(
      [
        '  subject HAS ROLE "maintainer"',
        "  AND",
        "  (",
        '    subject.dept equals "eng"',
        "    OR",
        '    subject.dept equals "ops"',
        "  )",
      ].join("\n"),
    );
  });

  it("ANDs the role, relation and condition clauses in that order", () => {
    expect(
      toDsl(
        doc({
          requireRole: "maintainer",
          relation: { object: "channel:", relation: "owner" },
          condition: all([leaf("subject.org_member", "eq", "true")]),
        }),
      ),
    ).toBe(
      [
        'POLICY "hr_view"',
        "EFFECT ALLOW",
        "ON employee_profile : read",
        "PRIORITY 30",
        "WHEN",
        '  subject HAS ROLE "maintainer"',
        "  AND",
        '  subject IS owner OF "channel:"',
        "  AND",
        '  subject.org_member equals "true"',
        "STATUS enabled",
      ].join("\n"),
    );
  });

  it("renders leaves with operator labels, quoted raw values, and NOT as a parenthesised block", () => {
    const dsl = toDsl(
      doc({
        condition: all([
          leaf("subject.dept", "eq", "eng"),
          leaf("subject.email", "exists", "ignored"),
          not(leaf("context.hour_of_day", "gte", "18")),
        ]),
      }),
    );
    expect(dsl).toContain(
      [
        "WHEN",
        '  subject.dept equals "eng"',
        "  AND",
        "  subject.email exists",
        "  AND",
        "  NOT (",
        '    context.hour_of_day greater or equal "18"',
        "  )",
      ].join("\n"),
    );
  });

  it("joins the children of an ANY group with OR", () => {
    const dsl = toDsl(
      doc({
        condition: any([leaf("context.network", "eq", "corp"), leaf("context.vpn", "eq", "on")]),
      }),
    );
    expect(dsl).toContain(
      ['  context.network equals "corp"', "  OR", '  context.vpn equals "on"'].join("\n"),
    );
  });

  it("parenthesises a nested group so AND/OR precedence stays explicit", () => {
    const dsl = toDsl(
      doc({
        condition: all([
          leaf("resource.environment", "eq", "production"),
          any([leaf("context.hour_of_day", "lt", "9"), leaf("context.hour_of_day", "gte", "18")]),
        ]),
      }),
    );
    expect(dsl).toContain(
      [
        "WHEN",
        '  resource.environment equals "production"',
        "  AND",
        "  (",
        '    context.hour_of_day less than "9"',
        "    OR",
        '    context.hour_of_day greater or equal "18"',
        "  )",
        "STATUS enabled",
      ].join("\n"),
    );
  });

  it("parenthesises every level of deeper nesting, but not a single-child group", () => {
    const dsl = toDsl(
      doc({
        condition: any([
          all([leaf("a.x", "eq", "1"), any([leaf("b.x", "eq", "2"), leaf("c.x", "eq", "3")])]),
          all([leaf("d.x", "eq", "4")]),
        ]),
      }),
    );
    expect(dsl).toContain(
      [
        "WHEN",
        "  (",
        '    a.x equals "1"',
        "    AND",
        "    (",
        '      b.x equals "2"',
        "      OR",
        '      c.x equals "3"',
        "    )",
        "  )",
        "  OR",
        '  d.x equals "4"',
        "STATUS enabled",
      ].join("\n"),
    );
  });

  it("escapes user-provided strings so they cannot inject extra DSL lines", () => {
    const name = 'x"\nEFFECT ALLOW';
    const role = 'admin"\nSTATUS enabled';
    const value = 'eng"\nOR\nsubject.any equals "*';
    const dsl = toDsl(
      doc({
        name,
        effect: "deny",
        requireRole: role,
        relation: { object: 'doc:"1"\n', relation: "owner" },
        condition: all([leaf("subject.dept", "eq", value)]),
      }),
    );
    const lines = dsl.split("\n");
    expect(lines[0]).toBe(`POLICY ${JSON.stringify(name)}`);
    expect(lines.filter((l) => l.startsWith("EFFECT"))).toEqual(["EFFECT DENY"]);
    expect(lines.filter((l) => l.startsWith("STATUS"))).toEqual(["STATUS enabled"]);
    expect(lines).toContain(`  subject HAS ROLE ${JSON.stringify(role)}`);
    expect(lines).toContain(`  subject IS owner OF ${JSON.stringify('doc:"1"\n')}`);
    expect(lines).toContain(`  subject.dept equals ${JSON.stringify(value)}`);
    expect(lines).toHaveLength(11);
  });
});

describe("toEvalTree", () => {
  function collectIds(node: EvalTreeNode): string[] {
    return [node.id, ...(node.children ?? []).flatMap(collectIds)];
  }

  it("is a single unconditional decision node when nothing constrains the policy", () => {
    expect(toEvalTree(doc({ resourceType: "", action: "" }))).toMatchObject({
      kind: "decision",
      label: "ALLOW *:*",
      detail: "unconditional",
      children: [],
    });
  });

  it("lists the RBAC block, the ReBAC block, then the condition under the decision", () => {
    const tree = toEvalTree(
      doc({
        effect: "deny",
        requireRole: "maintainer",
        relation: { object: "channel:", relation: "owner" },
        condition: all([leaf("subject.dept", "eq", "eng")]),
      }),
    );
    expect(tree.label).toBe("DENY employee_profile:read");
    expect(tree.detail).toBe("when all blocks match");
    expect(tree.children?.map((c) => [c.kind, c.label, c.detail])).toEqual([
      ["block", "RBAC", "require role “maintainer”"],
      ["block", "ReBAC", "owner of channel:"],
      ["and", "ALL of", undefined],
    ]);
  });

  it("keeps the nesting of ALL / ANY / NOT groups", () => {
    const tree = toEvalTree(
      doc({
        condition: all([
          leaf("resource.environment", "eq", "production"),
          any([leaf("context.hour_of_day", "lt", "9"), not(leaf("subject.email", "exists"))]),
          leaf("subject.dept", "eq", ""),
        ]),
      }),
    );
    const root = tree.children?.[0];
    assert(root, "condition node");
    expect(root).toMatchObject({ kind: "and", label: "ALL of" });
    const [env, anyNode, blank] = root.children ?? [];
    expect(env).toMatchObject({
      kind: "leaf",
      label: "resource.environment",
      detail: "equals production",
    });
    expect(anyNode).toMatchObject({ kind: "or", label: "ANY of" });
    expect(anyNode?.children?.[0]).toMatchObject({ kind: "leaf", detail: "less than 9" });
    expect(anyNode?.children?.[1]).toMatchObject({ kind: "not", label: "NOT" });
    expect(anyNode?.children?.[1]?.children?.[0]).toMatchObject({
      kind: "leaf",
      label: "subject.email",
      detail: "exists",
    });
    // A leaf still being edited shows a placeholder rather than an empty value.
    expect(blank).toMatchObject({ kind: "leaf", detail: "equals …" });
  });

  it("gives nodes unique ids that are stable across regenerations", () => {
    const d = doc({
      requireRole: "admin",
      condition: all([leaf("a.b", "eq", "1"), any([leaf("c.d", "eq", "2")])]),
    });
    const first = collectIds(toEvalTree(d));
    expect(new Set(first).size).toBe(first.length);
    expect(collectIds(toEvalTree(d))).toEqual(first);
  });
});
