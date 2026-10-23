import { assert, describe, expect, it } from "vitest";

import { type CondNode, countLeaves } from "../api/abac";
import { abacSaveBlocker, isReducibleToAbac, toAbacInput } from "../utils/policy-codegen";
import { findTemplate, POLICY_TEMPLATES, TEMPLATE_CATEGORIES } from "../utils/policy-template";

function build(id: string) {
  const template = findTemplate(id);
  assert(template, `template ${id}`);
  return template.build();
}

function nodeIds(node: CondNode | null): string[] {
  if (!node) return [];
  if (node.kind === "leaf") return [node.id];
  if (node.kind === "not") return [node.id, ...nodeIds(node.child)];
  return [node.id, ...node.children.flatMap(nodeIds)];
}

describe("policy template catalogue", () => {
  it("offers the four categories, each with at least one template", () => {
    expect(TEMPLATE_CATEGORIES).toEqual(["SaaS", "Cloud", "Regulated", "Baseline"]);
    for (const category of TEMPLATE_CATEGORIES) {
      expect(POLICY_TEMPLATES.some((t) => t.category === category)).toBe(true);
    }
  });

  it("has unique ids, and every template carries display metadata", () => {
    const ids = POLICY_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(12);
    for (const t of POLICY_TEMPLATES) {
      expect(t.name && t.vendor && t.description).toBeTruthy();
      expect(t.tags.length).toBeGreaterThan(0);
    }
  });

  it.each(POLICY_TEMPLATES.map((t) => [t.id]))(
    "%s builds a named, enabled, prioritised policy for a concrete target",
    (id) => {
      const d = build(id);
      expect(d.name).toMatch(/^[a-z0-9_]+$/);
      expect(d.description).not.toBe("");
      expect(d.resourceType).not.toBe("");
      expect(d.action).not.toBe("");
      expect(d.enabled).toBe(true);
      expect(d.priority).toBeGreaterThan(0);
      expect(d.priority).toBeLessThanOrEqual(100);
    },
  );

  it("builds a fresh document (with fresh condition ids) on every use", () => {
    for (const t of POLICY_TEMPLATES) {
      const a = t.build();
      const b = t.build();
      expect(a).not.toBe(b);
      expect(a.condition === null || a.condition !== b.condition).toBe(true);
      const ids = nodeIds(a.condition);
      expect(nodeIds(b.condition).some((id) => ids.includes(id))).toBe(false);
    }
  });

  it("marks the RBAC/ReBAC and attribute-comparison templates as not persistable as ABAC", () => {
    const notReducible = POLICY_TEMPLATES.filter((t) => !isReducibleToAbac(t.build())).map(
      (t) => t.id,
    );
    expect(notReducible.sort()).toEqual([
      "baseline-owner",
      "finance-sod",
      "github-repo-admin",
      "gov-clearance",
      "healthcare-phi",
      "jira-project-lead",
      "salesforce-region",
      "slack-channel-owner",
    ]);
  });

  it.each(["salesforce-region", "healthcare-phi", "finance-sod", "gov-clearance"])(
    "does not offer %s, which compares two attributes, as a saveable ABAC policy",
    (id) => {
      expect(abacSaveBlocker(build(id))).toMatch(/^Compares two attributes/);
    },
  );

  it("makes exactly the guard-rail templates deny policies", () => {
    const deny = POLICY_TEMPLATES.filter((t) => t.build().effect === "deny").map((t) => t.id);
    expect(deny.sort()).toEqual(["aws-prod-deploy-window", "baseline-mfa", "finance-sod"]);
  });
});

describe("findTemplate", () => {
  it("looks a template up by id", () => {
    expect(findTemplate("baseline-mfa")?.vendor).toBe("Baseline");
    expect(findTemplate("does-not-exist")).toBeUndefined();
  });
});

describe("template payloads", () => {
  it("blocks production deploys outside 09:00–18:00 with typed hour bounds", () => {
    expect(toAbacInput(build("aws-prod-deploy-window"))).toEqual({
      name: "no_after_hours_prod_deploy",
      description: "Production deploys are only permitted during business hours.",
      effect: "deny",
      resource_type: "deployment",
      action: "create",
      condition: {
        all: [
          { attr: "resource.environment", op: "eq", value: "production" },
          {
            any: [
              { attr: "context.hour_of_day", op: "lt", value: 9 },
              { attr: "context.hour_of_day", op: "gte", value: 18 },
            ],
          },
        ],
      },
      priority: 90,
      enabled: true,
    });
  });

  it("denies sensitive deletes on any resource unless the session is MFA-verified", () => {
    expect(toAbacInput(build("baseline-mfa"))).toMatchObject({
      effect: "deny",
      resource_type: "*",
      action: "delete",
      condition: { all: [{ attr: "context.mfa", op: "ne", value: true }] },
      priority: 85,
    });
  });

  it("restricts every resource and action to the corporate network", () => {
    expect(toAbacInput(build("azure-corp-network"))).toMatchObject({
      effect: "allow",
      resource_type: "*",
      action: "*",
      condition: { all: [{ attr: "context.network", op: "eq", value: "corp" }] },
      priority: 50,
    });
  });

  it("lets the HR department read employee profiles", () => {
    expect(toAbacInput(build("organization-hr-profiles"))).toMatchObject({
      effect: "allow",
      resource_type: "employee_profile",
      action: "read",
      condition: { all: [{ attr: "subject.department", op: "eq", value: "HR" }] },
      priority: 30,
    });
  });

  it("combines a role requirement with an org-member condition for repo admins", () => {
    const d = build("github-repo-admin");
    expect(d).toMatchObject({
      resourceType: "repository",
      action: "admin",
      requireRole: "maintainer",
      relation: null,
      priority: 40,
    });
    assert(d.condition, "condition");
    expect(countLeaves(d.condition)).toBe(1);
  });

  it("models ownership templates as ReBAC relations rather than conditions", () => {
    expect(build("slack-channel-owner")).toMatchObject({
      resourceType: "channel",
      action: "manage_members",
      relation: { object: "channel:", relation: "owner" },
      condition: null,
    });
    expect(build("baseline-owner")).toMatchObject({
      resourceType: "*",
      action: "*",
      relation: { object: "", relation: "owner" },
      condition: null,
    });
  });

  it("gates issue edits on the project lead role alone", () => {
    expect(build("jira-project-lead")).toMatchObject({
      resourceType: "issue",
      action: "edit",
      requireRole: "project_lead",
      relation: null,
      condition: null,
    });
  });
});
