import { describe, expect, it } from "vitest";

import type { ControlResult, EvidenceRun } from "../api/evidence";
import { fixFor, fixPlaces, missingOf, streakOf } from "../evidence-model";
import { dueCount, nextDue } from "../retention-model";

const c = (id: string, status: ControlResult["status"]): ControlResult => ({
  id,
  name: id,
  category: "",
  criteria: id.split("-")[0] ?? id,
  status,
  detail: "",
});
const run = (at: string, controls: ControlResult[]): EvidenceRun => ({
  id: at,
  tenant_id: "t",
  framework: "soc2",
  generated_at: at,
  pass_count: 0,
  fail_count: 0,
  na_count: 0,
  controls,
});

describe("where a check is fixed", () => {
  it("sends each check to the page that changes what it reads", () => {
    expect(fixFor("CC6.1-MFA")?.to).toBe("/settings/organization/security-policy");
    expect(fixFor("A.9.4-SESSION")?.to).toBe("/settings/organization/security-policy");
    // Password rules are the auth policy's (Sign-in › Password), not the security policy's.
    expect(fixFor("A.9.4.3-PWD-CMPLX")?.to).toBe("/auth/login-methods/password");
    expect(fixFor("CC6.6-IP-ACL")?.place).toBe("ipRules");
    expect(fixFor("A.13.1-IP")?.place).toBe("ipRules");
    expect(fixFor("A.9.2-RBAC")?.place).toBe("roles");
    expect(fixFor("A.18.1-GDPR")?.to).toBe("/security/compliance/gdpr");
    expect(fixFor("CC9.9-UNKNOWN")).toBeNull();
  });

  it("counts the distinct places the failing checks are fixed", () => {
    expect(
      fixPlaces([c("CC6.1-MFA", "fail"), c("CC6.1-SESSION", "fail"), c("CC6.6-IP-ACL", "fail")]),
    ).toBe(2);
  });

  it("lists failing checks before those without evidence, keeping the server's order", () => {
    const missing = missingOf([
      c("A-na", "na"),
      c("B-fail", "fail"),
      c("C-pass", "pass"),
      c("D-fail", "fail"),
    ]);
    expect(missing.map((m) => m.id)).toEqual(["B-fail", "D-fail", "A-na"]);
  });
});

describe("how long a check has had its status", () => {
  const runs = [
    run("2026-10-07", [c("X", "fail")]),
    run("2026-09-07", [c("X", "fail")]),
    run("2026-08-07", [c("X", "pass")]),
  ];

  it("runs back until the status changes, and names the status before", () => {
    expect(streakOf(runs, "X", 3)).toMatchObject({
      runs: 2,
      since: "2026-09-07",
      everyRun: false,
      capped: false,
      before: "pass",
    });
  });

  it("knows when the streak covers every run on record", () => {
    expect(streakOf(runs.slice(0, 2), "X", 2)).toMatchObject({ runs: 2, everyRun: true });
  });

  it("says so when it reaches the last run read and older ones exist", () => {
    expect(streakOf(runs.slice(0, 2), "X", 14)).toMatchObject({ runs: 2, capped: true });
  });

  it("waits for the runs to load", () => {
    expect(streakOf([undefined], "X", 3)).toBeNull();
  });
});

describe("retention due dates", () => {
  const DAY = 86_400_000;
  const now = Date.parse("2026-10-28T00:00:00Z");
  const deleted = [
    {
      id: "a",
      email: "a@x",
      display_name: "A",
      deleted_at: "2026-10-18T00:00:00Z",
      created_at: "",
    },
    {
      id: "b",
      email: "b@x",
      display_name: "B",
      deleted_at: "2026-09-18T00:00:00Z",
      created_at: "",
    },
  ];

  it("counts who a window makes due", () => {
    expect(dueCount(deleted, 30, now)).toBe(1);
    expect(dueCount(deleted, 7, now)).toBe(2);
    expect(dueCount(deleted, 90, now)).toBe(0);
  });

  it("finds the next person due, and when", () => {
    const next = nextDue(deleted, 30, now);
    expect(next?.user.id).toBe("a");
    expect(next?.at).toBe(Date.parse("2026-10-18T00:00:00Z") + 30 * DAY);
  });
});
