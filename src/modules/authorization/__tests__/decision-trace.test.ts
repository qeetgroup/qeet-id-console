import { describe, expect, it } from "vitest";
import "@/i18n";

import { traceSteps } from "../components/explain/decision-trace";

// The lines decide.go and abac.go write (qeet-id-server, internal/access/authorization).
describe("a composed decision's trace", () => {
  it("reads each engine's step, in order, and never the organisation's id", () => {
    const steps = traceSteps(
      [
        "tenant: 9b1c3d4e-0000-0000-0000-000000000000",
        'abac: policy "Block sanctioned countries" (effect=deny, priority=1000): condition not matched',
        "abac: no matching allow policy found → default deny",
        "rbac: a role grants role.write, allowed",
      ],
      true,
    );
    expect(steps.map((s) => [s.where, s.title, s.outcome, s.tone])).toEqual([
      ["Organisation", "This organisation", "Checked", "neutral"],
      ["ABAC · priority 1000 · deny", "Block sanctioned countries", "Not matched", "neutral"],
      // Composed, ABAC's default deny decides nothing: roles still may allow.
      ["ABAC", "No allow policy matched", "No decision", "neutral"],
      ["RBAC", "A role grants role.write", "Allowed", "success"],
    ]);
    expect(steps[1]?.policyName).toBe("Block sanctioned countries");
  });

  it("reads a deny, a relationship and the default refusal", () => {
    const steps = traceSteps(
      [
        'abac: policy "Contractors: \\"hours\\"" (effect=deny, priority=600): condition matched → deny',
        "abac: no policy can change this, skipped",
        "abac: attribute policies evaluated",
        "rebac: no viewer on document:readme",
        "rebac: editor on document:readme, allowed",
        'abac: allowed by policy "Engineers read logs" (priority 100), allowed',
        "none: nothing allows it, refused",
        "rbac: error, refused (pq: connection reset)",
      ],
      true,
    );
    expect(steps.map((s) => [s.title, s.outcome, s.tone])).toEqual([
      ['Contractors: "hours"', "Matched: deny", "danger"],
      ["No attribute policy can change this", "Skipped", "neutral"],
      ["Attribute policies checked; you need policy.read to see which", "Checked", "neutral"],
      ["No viewer on document:readme", "Not granted", "neutral"],
      ["editor on document:readme", "Allowed", "success"],
      ["Engineers read logs", "Allowed", "success"],
      ["Nothing allows it", "Denied by default", "danger"],
      // The engine's error is internal: it is never shown.
      ["The engine failed", "Refused", "danger"],
    ]);
  });
});

describe("the attribute engine's own trace", () => {
  it("reads absent attributes, condition errors and the default deny", () => {
    const steps = traceSteps(
      [
        'policy "geo" (effect=deny, priority=5): an attribute the condition compares is absent → deny',
        'policy "geo2" (effect=allow, priority=4): an attribute the condition compares is absent → not matched',
        'policy "broken": condition error (abac: all[0]: bad) → fail-closed deny',
        "no matching allow policy found → default deny",
        "something new the server says",
      ],
      false,
    );
    expect(steps.map((s) => [s.title, s.outcome, s.tone])).toEqual([
      ["geo", "Attribute absent: deny", "danger"],
      ["geo2", "Attribute absent: not matched", "neutral"],
      ["broken", "Couldn't evaluate: refused", "danger"],
      ["No allow policy matched", "Denied by default", "danger"],
      ["A step the console can't display", "", "neutral"],
    ]);
  });
});
