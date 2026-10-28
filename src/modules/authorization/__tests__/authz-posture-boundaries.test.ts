import { describe, expect, it } from "vitest";

import type { AbacPolicy } from "../api/abac";
import { postureFindings } from "../authz-posture";

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
