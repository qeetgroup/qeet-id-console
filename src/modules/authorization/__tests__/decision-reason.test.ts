import { describe, expect, it } from "vitest";

import i18n from "@/i18n";
import type { DecisionRecord } from "../api/simulate";
import {
  explainCode,
  explainDecidedBy,
  explainDecision,
  explainReason,
  explainReasonFields,
  explainTraceStep,
} from "../components/explain/decision-reason";

describe("explainReason", () => {
  it.each([
    [
      "no role grants this permission for this user in this tenant",
      { key: "rbac:check.deniedReason" },
    ],
    [
      'explicitly denied by policy "deny_contractors" (priority 90)',
      { key: "rbac:decisionExplain.reason.explicitDeny", name: "deny_contractors", priority: "90" },
    ],
    [
      'denied by policy "geo" (priority -5): an attribute it compares is absent',
      { key: "rbac:decisionExplain.reason.absentDeny", name: "geo", priority: "-5" },
    ],
    [
      'allowed by policy "hr_view" (priority 30)',
      { key: "rbac:decisionExplain.reason.allowed", name: "hr_view", priority: "30" },
    ],
    ["no matching allow policy", { key: "rbac:decisionExplain.reason.noAllow" }],
    [
      'condition error in policy "geo": unknown operator "near"',
      { key: "rbac:decisionExplain.reason.conditionError", name: "geo", priority: undefined },
    ],
    [
      'condition error in policy "geo"',
      { key: "rbac:decisionExplain.reason.conditionError", name: "geo", priority: undefined },
    ],
  ])("maps %j", (reason, explained) => {
    expect(explainReason(reason)).toEqual(explained);
  });

  it("reads a Go-quoted name back, escapes and all", () => {
    expect(explainReason('allowed by policy "say \\"hi\\" \\\\ ok" (priority 1)')?.name).toBe(
      'say "hi" \\ ok',
    );
  });

  it.each([
    "",
    "denied",
    'pq: relation "abac_policies" does not exist',
    'explicitly denied by policy "x" (priority 9) and more',
    'prefix explicitly denied by policy "x" (priority 9)',
  ])("vouches for nothing else: %j", (reason) => {
    expect(explainReason(reason)).toBeNull();
  });

  it("points at catalogue entries that exist", () => {
    for (const reason of [
      "no role grants this permission for this user in this tenant",
      'explicitly denied by policy "a" (priority 1)',
      'denied by policy "a" (priority 1): an attribute it compares is absent',
      'allowed by policy "a" (priority 1)',
      "no matching allow policy",
      'condition error in policy "a": boom',
    ]) {
      const key = explainReason(reason)?.key ?? "";
      expect(i18n.exists(key, { lng: "en" })).toBe(true);
    }
  });
});

describe("explainTraceStep", () => {
  it.each([
    [
      'policy "p" (effect=allow, priority=10): condition not matched',
      { key: "rbac:decisionExplain.trace.notMatched", effect: "allow", priority: "10" },
    ],
    [
      'policy "p" (effect=deny, priority=95): condition matched → deny',
      { key: "rbac:decisionExplain.trace.matched", effect: "deny", priority: "95" },
    ],
    [
      'policy "p" (effect=deny, priority=1): an attribute the condition compares is absent → deny',
      { key: "rbac:decisionExplain.trace.absentApplies", effect: "deny", priority: "1" },
    ],
    [
      'policy "p" (effect=allow, priority=1): an attribute the condition compares is absent → not matched',
      { key: "rbac:decisionExplain.trace.absentNotMatched", effect: "allow", priority: "1" },
    ],
  ])("maps %j", (step, explained) => {
    expect(explainTraceStep(step)).toEqual({ name: "p", ...explained });
  });

  it("names the policy behind a condition error without its error", () => {
    for (const step of [
      'policy "geo": condition error (bad value (x) → y) → fail-closed deny',
      'policy "geo": condition error → fail-closed deny',
    ]) {
      expect(explainTraceStep(step)).toEqual({
        key: "rbac:decisionExplain.trace.conditionError",
        name: "geo",
      });
    }
  });

  it("maps the default deny and reads anything else as a generic step", () => {
    expect(explainTraceStep("no matching allow policy found → default deny")).toEqual({
      key: "rbac:decisionExplain.trace.defaultDeny",
    });
    expect(
      explainTraceStep('policy "p" (effect=allow, priority=1): condition matched → deny'),
    ).toEqual({ key: "rbac:decisionExplain.trace.unknown" });
    expect(explainTraceStep("internal: stack trace")).toEqual({
      key: "rbac:decisionExplain.trace.unknown",
    });
  });
});

describe("explainCode", () => {
  it.each([
    ["authz.allowed_by_policy", "allowed", "allowedUnnamed"],
    ["authz.denied_by_policy", "explicitDeny", "explicitDenyUnnamed"],
    ["authz.attribute_absent", "absentDeny", "absentDenyUnnamed"],
  ])("words %s with its policy, or without one the caller may not read", (code, named, unnamed) => {
    const params = { policy_id: "p1", policy_name: "geo", priority: 90 };
    expect(explainCode(code, params)).toMatchObject({
      key: `rbac:decisionExplain.reason.${named}`,
      name: "geo",
      priority: "90",
    });
    expect(explainCode(code)).toEqual({ key: `rbac:decisionExplain.reason.${unnamed}` });
    expect(explainCode(code, { policy_name: "geo" })).toEqual({
      key: `rbac:decisionExplain.reason.${unnamed}`,
    });
  });

  it("words the composed decision's codes with what they name", () => {
    expect(explainCode("authz.role_grant", { permission: "user.read" })).toMatchObject({
      key: "rbac:decisionExplain.reason.roleGrant",
      permission: "user.read",
    });
    expect(explainCode("authz.role_grant")).toEqual({
      key: "rbac:decisionExplain.reason.roleGrantUnnamed",
    });
    expect(
      explainCode("authz.relation_grant", { relation: "viewer", object: "doc:1" }),
    ).toMatchObject({ key: "rbac:decisionExplain.reason.relationGrant" });
    for (const [code, key] of [
      ["authz.condition_error", "conditionErrorUnnamed"],
      ["authz.no_matching_allow", "noAllow"],
      ["authz.nothing_allows", "nothingAllows"],
      ["authz.no_tenant", "noTenant"],
      ["authz.engine_error", "engineError"],
    ]) {
      expect(explainCode(code ?? "")).toEqual({ key: `rbac:decisionExplain.reason.${key}` });
    }
    expect(explainCode("authz.no_role_grant")).toEqual({ key: "rbac:check.deniedReason" });
  });

  it("reads an unknown code as a generic line", () => {
    for (const code of ["authz.something_new", "constructor", ""]) {
      expect(explainCode(code)).toEqual({ key: "rbac:decisionExplain.reason.unknown" });
    }
  });

  it("points every code at catalogue entries that exist", () => {
    const codes = [
      "authz.allowed_by_policy",
      "authz.denied_by_policy",
      "authz.attribute_absent",
      "authz.condition_error",
      "authz.no_matching_allow",
      "authz.no_role_grant",
      "authz.role_grant",
      "authz.relation_grant",
      "authz.nothing_allows",
      "authz.no_tenant",
      "authz.engine_error",
      "unknown",
    ];
    const params = {
      policy_name: "p",
      priority: 1,
      permission: "x.read",
      relation: "viewer",
      object: "doc:1",
    };
    for (const code of codes) {
      for (const key of [explainCode(code, params).key, explainCode(code).key]) {
        expect(i18n.exists(key, { lng: "en" })).toBe(true);
      }
    }
  });
});

describe("explainReasonFields / explainDecidedBy", () => {
  it("prefers the code to the sentence", () => {
    expect(
      explainReasonFields({
        reason: 'allowed by policy "hr" (priority 3)',
        reason_code: "authz.denied_by_policy",
      }),
    ).toEqual({ key: "rbac:decisionExplain.reason.explicitDenyUnnamed" });
  });

  it("maps a known sentence when there is no code, and never shows an unknown one", () => {
    expect(explainReasonFields({ reason: 'allowed by policy "hr" (priority 3)' })).toEqual({
      key: "rbac:decisionExplain.reason.allowed",
      name: "hr",
      priority: "3",
    });
    expect(explainReasonFields({ reason: "pq: deadlock detected" })).toEqual({
      key: "rbac:decisionExplain.reason.unknown",
    });
    expect(explainReasonFields({})).toBeNull();
  });

  it("summarises decided_by from its code alone", () => {
    expect(
      explainDecidedBy({
        model: "rbac",
        rule: "role grants user.read",
        reason_code: "authz.role_grant",
        reason_params: { permission: "user.read" },
      }),
    ).toMatchObject({ key: "rbac:decisionExplain.reason.roleGrant", permission: "user.read" });
    expect(explainDecidedBy({ model: "none", rule: "nothing allows it" })).toBeNull();
    expect(explainDecidedBy(undefined)).toBeNull();
  });
});

describe("explainDecision", () => {
  function record(overrides: Partial<DecisionRecord>): DecisionRecord {
    return {
      id: "d1",
      engine: "abac",
      allowed: false,
      at: "",
      durationMs: 1,
      input: {},
      ...overrides,
    };
  }

  it("reads the engine's own reason code before its sentence", () => {
    expect(
      explainDecision(
        record({
          reason: "anything at all",
          abac: {
            allow: false,
            effect: "deny",
            reason: "anything at all",
            reason_code: "authz.denied_by_policy",
            reason_params: { policy_id: "p1", policy_name: "geo", priority: 90 },
          },
        }),
      ),
    ).toMatchObject({
      key: "rbac:decisionExplain.reason.explicitDeny",
      name: "geo",
      priority: "90",
    });
  });

  it("falls back to decided_by when the engine states no reason", () => {
    const decided_by = {
      model: "rbac",
      reason_code: "authz.role_grant",
      reason_params: { permission: "user.read" },
    };
    expect(
      explainDecision(
        record({ engine: "rbac", allowed: true, rbac: { allowed: true, paths: [], decided_by } }),
      ),
    ).toMatchObject({ key: "rbac:decisionExplain.reason.roleGrant" });
    expect(
      explainDecision(
        record({
          engine: "authzen",
          allowed: false,
          authzen: {
            decision: false,
            context: { decided_by: { model: "none", reason_code: "authz.nothing_allows" } },
          },
        }),
      ),
    ).toEqual({ key: "rbac:decisionExplain.reason.nothingAllows" });
    expect(
      explainDecision(
        record({
          engine: "rebac",
          rebac: { allowed: false, decided_by: { model: "none", rule: "nothing allows it" } },
        }),
      ),
    ).toBeNull();
  });
});
