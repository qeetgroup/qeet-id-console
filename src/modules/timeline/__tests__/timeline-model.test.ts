import { describe, expect, it } from "vitest";

import type { ActivityEvent } from "@/modules/activity";
import {
  activityRecord,
  byDay,
  dayKey,
  eventsByDay,
  eventTitle,
  linkApp,
  periodDayList,
  periodStart,
  sumSignIns,
  whoDid,
} from "../timeline-model";

const ME = "u-1";
// Local times, so the days don't depend on the machine's time zone.
const NOW = new Date(2026, 9, 28, 12, 0).getTime();
let id = 0;
function ev(type: string, at: Date, more: Partial<ActivityEvent> = {}): ActivityEvent {
  id++;
  return {
    id: `e-${id}`,
    type,
    category: "authentication",
    severity: "info",
    title: type,
    at: at.toISOString(),
    actor: { id: ME, name: "Ananya Iyer", type: "user" },
    ...more,
  };
}
const signIn = (method: string, at: Date, more: Partial<ActivityEvent> = {}) =>
  ev("auth.login_succeeded", at, { metadata: { method }, ...more });

describe("the period", () => {
  it("starts at local midnight, the period's length back, today included", () => {
    expect(periodStart("30d", NOW)).toEqual(new Date(2026, 8, 29));
    expect(periodStart("7d", NOW)).toEqual(new Date(2026, 9, 22));
    const days = periodDayList("7d", NOW);
    expect(days).toHaveLength(7);
    expect(dayKey(days[6] ?? 0)).toBe("2026-10-28");
  });

  it("folds the summary's buckets into local days, failures with them", () => {
    const days = eventsByDay(
      [
        {
          at: new Date(2026, 9, 28, 9, 15).toISOString(),
          count: 3,
          failed: 1,
          success: 2,
          warning: 0,
          info: 0,
          critical: 0,
        },
        {
          at: new Date(2026, 9, 28, 23, 45).toISOString(),
          count: 2,
          failed: 0,
          success: 2,
          warning: 0,
          info: 0,
          critical: 0,
        },
        {
          at: new Date(2026, 9, 26, 0, 0).toISOString(),
          count: 4,
          failed: 0,
          success: 4,
          warning: 0,
          info: 0,
          critical: 0,
        },
        // Before the period: left out.
        {
          at: new Date(2026, 9, 1).toISOString(),
          count: 9,
          failed: 0,
          success: 9,
          warning: 0,
          info: 0,
          critical: 0,
        },
      ],
      "7d",
      NOW,
    );
    expect(days.map((d) => d.count)).toEqual([0, 0, 0, 0, 4, 0, 5]);
    expect(days.map((d) => d.failed)).toEqual([0, 0, 0, 0, 0, 0, 1]);
  });
});

describe("the sign-ins summed up", () => {
  const today = new Date(2026, 9, 28, 10, 0);
  const s = sumSignIns([
    signIn("passkey", today, { ip: "203.0.113.10", browser: "Edge" }),
    signIn("social_mfa", today, { ip: "203.0.113.10", browser: "Chrome" }),
    signIn("saml", today, { ip: "203.0.113.46", browser: "Chrome" }),
    signIn("passkey", today, { ip: "203.0.113.10", browser: "Edge" }),
    signIn("tenant_switch", today, { ip: "198.51.100.1" }),
    ev("auth.sign_in_failed", today, {
      metadata: { method: "password", reason: "wrong_password" },
      ip: "203.0.113.99",
    }),
    ev("auth.sign_in_failed", today, { metadata: { method: "mfa", reason: "code_invalid" } }),
  ]);

  it("counts sign-ins and those with two-step, not the switches into the organisation", () => {
    expect(s.signIns).toBe(4);
    expect(s.twoStep).toBe(3); // the passkeys and the challenged social sign-in
    expect(s.moves).toBe(1);
    expect(s.top).toEqual({ method: "passkey", count: 2 });
  });

  it("ranks the failures, the addresses and the browsers", () => {
    expect(s.failed).toBe(2);
    expect(s.failures).toEqual([
      { reason: "wrong_password", count: 1 },
      { reason: "code_invalid", count: 1 },
    ]);
    expect(s.addresses).toEqual([
      { ip: "203.0.113.10", count: 3 },
      { ip: "203.0.113.46", count: 1 },
      { ip: "203.0.113.99", count: 1 },
    ]);
    expect(s.browsers).toEqual(["Edge", "Chrome"]);
  });
});

describe("what each event says", () => {
  const at = new Date(2026, 9, 28, 10, 0);

  it("reads a sign-in's method and second step, and a switch as a move", () => {
    expect(eventTitle(signIn("password_mfa", at), ME)).toEqual({
      kind: "signedIn",
      method: "password",
      twoStep: true,
    });
    expect(eventTitle(signIn("passkey", at), ME)).toMatchObject({
      method: "passkey",
      twoStep: true,
    });
    expect(eventTitle(signIn("carrier_pigeon", at), ME)).toMatchObject({ method: "other" });
    expect(eventTitle(signIn("tenant_switch", at), ME)).toEqual({
      kind: "moved",
      method: "tenant_switch",
    });
  });

  it("reads why a sign-in failed and how a session ended", () => {
    const failed = ev("auth.sign_in_failed", at, { metadata: { reason: "wrong_password" } });
    expect(eventTitle(failed, ME)).toEqual({ kind: "signInFailed", reason: "wrong_password" });
    const idle = ev("auth.session_expired", at, { metadata: { reason: "idle" } });
    expect(eventTitle(idle, ME)).toEqual({ kind: "sessionEnded", idle: true });
  });

  it("words a change to the person's record about them, and an admin's change to someone else", () => {
    const given = ev("role.assigned", at, {
      actor: { id: "u-2", name: "Priya Nair", type: "user" },
      target: { type: "user", id: ME },
      metadata: { role_id: "r-1" },
    });
    expect(eventTitle(given, ME)).toEqual({ kind: "about", key: "roleAssigned", roleId: "r-1" });
    // On Priya's own timeline, the same event is something she did to Ananya.
    expect(eventTitle(given, "u-2")).toEqual({
      kind: "toOther",
      key: "roleAssigned",
      personId: ME,
      roleId: "r-1",
    });
  });

  it("names the SAML app signed in to, and which sign-in page a link was for", () => {
    const saml = ev("saml.idp_assertion_issued", at, {
      metadata: { sp_entity_id: "https://slack.com/" },
    });
    expect(eventTitle(saml, ME)).toEqual({ kind: "samlApp", app: "slack.com" });
    const hosted = ev("auth.magic_link_requested", at, { metadata: { app: "hosted_login" } });
    expect(linkApp(hosted)).toBe("hosted");
    expect(linkApp(ev("auth.magic_link_consumed", at, { metadata: { app: "" } }))).toBe("console");
    expect(linkApp(signIn("saml", at))).toBeUndefined();
  });

  it("leaves an event it has no words for to Activity's", () => {
    expect(eventTitle(ev("group.created", at), ME)).toEqual({ kind: "other" });
  });

  it("says who did it: the person, someone else, or a part of Qeet ID", () => {
    expect(whoDid(signIn("saml", at), ME)).toEqual({ kind: "self" });
    expect(
      whoDid(
        ev("user.created", at, { actor: { id: "u-2", name: "Priya Nair", type: "user" } }),
        ME,
      ),
    ).toEqual({
      kind: "person",
      name: "Priya Nair",
    });
    expect(whoDid(ev("user.created", at, { actor: { type: "scim" } }), ME)).toEqual({
      kind: "service",
      service: "scim",
    });
  });
});

describe("the events by day", () => {
  it("groups the newest-first events by local day, and links each to its day in Activity", () => {
    const late = ev("auth.mfa_challenged", new Date(2026, 9, 28, 9, 0));
    const early = ev("auth.mfa_challenged", new Date(2026, 9, 28, 8, 0));
    const before = ev("auth.mfa_challenged", new Date(2026, 9, 26, 23, 59));
    expect(byDay([late, early, before]).map((g) => [g.key, g.events.length])).toEqual([
      ["2026-10-28", 2],
      ["2026-10-26", 1],
    ]);
    expect(activityRecord(before)).toEqual({
      range: "custom",
      from: new Date(2026, 9, 26).toISOString(),
      to: new Date(new Date(2026, 9, 27).getTime() - 1).toISOString(),
      event: before.id,
    });
  });
});
