import { describe, expect, it } from "vitest";

import type { AbacPolicy } from "../api/abac";
import type { Permission } from "../api/rbac";
import { postureFindings } from "../authz-posture";

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
