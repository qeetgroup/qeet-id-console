import { describe, expect, it } from "vitest";

import type { AbacPolicy } from "../api/abac";
import type { AuditEvent } from "../api/audit";
import type { Permission } from "../api/rbac";
import {
  auditTrend,
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
    id: crypto.randomUUID(),
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

function event(action: string, at = "2026-01-05T00:00:00Z"): AuditEvent {
  return {
    id: `${action}-${at}`,
    tenant_id: "t",
    actor_user_id: "u",
    actor_type: "user",
    action,
    resource_type: action.split(".")[0],
    resource_id: null,
    ip: null,
    user_agent: null,
    request_id: null,
    created_at: at,
  };
}

describe("postureFindings", () => {
  it("counts each check against live configuration", () => {
    const findings = postureFindings(
      [perm("projects.read"), perm("projects.*"), perm("users.*")],
      [
        policy({ condition: null }), // unconditional allow
        policy({ enabled: false }),
        policy({ effect: "deny" }),
      ],
    );

    expect(findings).toEqual([
      { id: "wildcard", severity: "high", count: 2 },
      { id: "unconditional", severity: "medium", count: 1 },
      { id: "disabled", severity: "info", count: 1 },
      { id: "deny", severity: "info", count: 1 },
    ]);
  });

  it("does not count a disabled policy as an unconditional allow", () => {
    const findings = postureFindings([], [policy({ condition: null, enabled: false })]);
    expect(findings.find((f) => f.id === "unconditional")?.count).toBe(0);
    expect(findings.find((f) => f.id === "disabled")?.count).toBe(1);
  });
});

describe("policyHealth", () => {
  it("scores a clean configuration at 100", () => {
    expect(policyHealth(postureFindings([perm("projects.read")], []))).toEqual({
      score: 100,
      band: "good",
      critical: 0,
      warnings: 0,
      info: 0,
    });
  });

  it("deducts for high and medium findings, but never for info", () => {
    const infoOnly = policyHealth([
      { id: "disabled", severity: "info", count: 4 },
      { id: "deny", severity: "info", count: 3 },
    ]);
    expect(infoOnly).toMatchObject({ score: 100, band: "good", info: 2 });

    // one high (15) + one medium (8)
    const mixed = policyHealth([
      { id: "wildcard", severity: "high", count: 1 },
      { id: "unconditional", severity: "medium", count: 1 },
    ]);
    expect(mixed).toMatchObject({ score: 77, band: "fair", critical: 1, warnings: 1 });
  });

  it("scales with volume but caps the per-finding deduction", () => {
    const five = policyHealth([{ id: "wildcard", severity: "high", count: 6 }]);
    const fifty = policyHealth([{ id: "wildcard", severity: "high", count: 50 }]);
    // 15 base + 5 extras x 3 = 30, and the cap holds beyond six items.
    expect(five.score).toBe(70);
    expect(fifty.score).toBe(70);
  });

  it("drops to at-risk once findings pile up", () => {
    const health = policyHealth([
      { id: "wildcard", severity: "high", count: 6 },
      { id: "unconditional", severity: "medium", count: 6 },
    ]);
    expect(health.score).toBe(52);
    expect(health.band).toBe("atRisk");
  });
});

describe("resourceTypes", () => {
  it("takes the segment before the first separator and de-duplicates", () => {
    expect(
      resourceTypes([perm("projects.read"), perm("projects.write"), perm("users:write")]),
    ).toEqual(["projects", "users"]);
  });
});

describe("resourceCoverage", () => {
  const perms = [perm("projects.read"), perm("users.read"), perm("billing.read")];

  it("counts resource types with at least one enabled policy", () => {
    expect(resourceCoverage(perms, [policy({ resource_type: "projects" })])).toEqual({
      total: 3,
      protected: 1,
      unprotected: 2,
      percent: 33,
    });
  });

  it("ignores disabled policies", () => {
    expect(
      resourceCoverage(perms, [policy({ resource_type: "projects", enabled: false })]),
    ).toMatchObject({ protected: 0, percent: 0 });
  });

  it("treats a wildcard policy as covering everything", () => {
    expect(resourceCoverage(perms, [policy({ resource_type: "*" })])).toMatchObject({
      protected: 3,
      percent: 100,
    });
  });

  it("reports 0% rather than dividing by zero when nothing is defined", () => {
    expect(resourceCoverage([], [])).toEqual({
      total: 0,
      protected: 0,
      unprotected: 0,
      percent: 0,
    });
  });
});

describe("auditTrend", () => {
  it("reconstructs the change against the start of the window", () => {
    // 10 roles now, 2 created in the window → 8 at the start → +25%.
    expect(auditTrend([event("role.created"), event("role.created")], "role", 10)).toEqual({
      delta: 2,
      percent: 25,
    });
  });

  it("nets deletes against creates", () => {
    expect(
      auditTrend([event("role.created"), event("role.deleted"), event("role.deleted")], "role", 4),
    ).toEqual({ delta: -1, percent: -20 });
  });

  it("returns null when the window holds no create/delete events", () => {
    expect(auditTrend([event("role.assigned")], "role", 3)).toBeNull();
    expect(auditTrend([], "abac_policy", 0)).toBeNull();
  });

  it("only counts the requested entity", () => {
    expect(auditTrend([event("abac_policy.created")], "role", 5)).toBeNull();
  });
});
