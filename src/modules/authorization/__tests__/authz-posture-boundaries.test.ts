import { describe, expect, it } from "vitest";

import type { AbacPolicy } from "../api/abac";
import type { AuditEvent } from "../api/audit";
import type { Permission } from "../api/rbac";
import {
  auditTrend,
  type PostureFinding,
  policyHealth,
  postureFindings,
  resourceCoverage,
  resourceTypes,
} from "../authz-posture";

function perm(key: string): Permission {
  return { id: key, key, description: "" };
}

function policy(overrides: Partial<AbacPolicy> = {}): AbacPolicy {
  return {
    id: "p",
    tenant_id: "t",
    name: "policy",
    description: "",
    effect: "allow",
    resource_type: "projects",
    action: "read",
    condition: { attr: "subject.dept", op: "eq", value: "eng" },
    priority: 0,
    enabled: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function events(...actions: string[]): AuditEvent[] {
  return actions.map((action, i) => ({
    id: `${i}`,
    tenant_id: "t",
    actor_user_id: "u",
    actor_type: "user",
    action,
    resource_type: "",
    resource_id: null,
    ip: null,
    user_agent: null,
    request_id: null,
    created_at: "2026-01-05T00:00:00Z",
  }));
}

const high = (count: number): PostureFinding => ({ id: "wildcard", severity: "high", count });
const medium = (count: number): PostureFinding => ({
  id: "unconditional",
  severity: "medium",
  count,
});

describe("postureFindings boundaries", () => {
  it("does not count an unconditional deny as an unconditional allow", () => {
    const findings = postureFindings([], [policy({ effect: "deny", condition: null })]);
    expect(findings.map((f) => [f.id, f.count])).toEqual([
      ["wildcard", 0],
      ["unconditional", 0],
      ["disabled", 0],
      ["deny", 1],
    ]);
  });

  it("counts a disabled deny as both disabled and deny", () => {
    const findings = postureFindings([], [policy({ effect: "deny", enabled: false })]);
    expect(findings.find((f) => f.id === "disabled")?.count).toBe(1);
    expect(findings.find((f) => f.id === "deny")?.count).toBe(1);
  });
});

describe("policyHealth bands", () => {
  it.each([
    ["one high finding (85)", [high(1)], 85, "good"],
    ["four unconditional allows (86)", [medium(4)], 86, "good"],
    ["five unconditional allows (84)", [medium(5)], 84, "fair"],
    ["the fair floor (60)", [high(6), medium(2)], 60, "fair"],
    ["just under the fair floor (58)", [high(6), medium(3)], 58, "atRisk"],
  ] as const)("bands %s", (_label, findings, score, band) => {
    expect(policyHealth([...findings])).toMatchObject({ score, band });
  });

  it("never scores below zero", () => {
    const health = policyHealth([high(6), high(6), high(6), high(6)]);
    expect(health).toMatchObject({ score: 0, band: "atRisk", critical: 4 });
  });

  it("counts findings, not the items inside them", () => {
    expect(policyHealth([high(9), medium(3)])).toMatchObject({ critical: 1, warnings: 1 });
  });
});

describe("resourceTypes / resourceCoverage boundaries", () => {
  it("trims keys and skips one with no resource segment", () => {
    expect(resourceTypes([perm("  users.read "), perm(".read"), perm("audit")])).toEqual([
      "audit",
      "users",
    ]);
  });

  it("matches a policy's resource type after trimming", () => {
    expect(
      resourceCoverage([perm("projects.read")], [policy({ resource_type: " projects " })]),
    ).toMatchObject({ protected: 1, percent: 100 });
  });

  it("does not treat a disabled wildcard policy as covering everything", () => {
    expect(
      resourceCoverage(
        [perm("projects.read"), perm("users.read")],
        [policy({ resource_type: "*", enabled: false })],
      ),
    ).toMatchObject({ protected: 0, unprotected: 2, percent: 0 });
  });

  it("rounds the coverage percentage", () => {
    expect(
      resourceCoverage(
        [perm("a.read"), perm("b.read"), perm("c.read")],
        [policy({ resource_type: "a" }), policy({ resource_type: "b" })],
      ).percent,
    ).toBe(67);
  });
});

describe("auditTrend boundaries", () => {
  it("reports +100% when everything in the count was created in the window", () => {
    expect(auditTrend(events("role.created", "role.created"), "role", 2)).toEqual({
      delta: 2,
      percent: 100,
    });
  });

  it("reports -100% when everything that existed was deleted", () => {
    expect(auditTrend(events("abac_policy.deleted"), "abac_policy", 0)).toEqual({
      delta: -1,
      percent: -100,
    });
  });

  it("reports 0% when creates and deletes cancel out from an empty start", () => {
    expect(auditTrend(events("role.created", "role.deleted"), "role", 0)).toEqual({
      delta: 0,
      percent: 0,
    });
  });
});
