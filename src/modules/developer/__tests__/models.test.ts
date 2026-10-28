import { describe, expect, it } from "vitest";

import type { Webhook, WebhookDelivery } from "../api/webhooks";
import {
  agentRow,
  DAY,
  datedStatus,
  keyRow,
  looksOf,
  type Machine,
  matches,
  reachOf,
  sortMachines,
  usedOf,
} from "../machine-model";
import {
  countOutcomes,
  deliveriesOverTime,
  endpointParts,
  eventAreas,
  notRetried,
  outcomeOf,
  overlapUntil,
  turnsOffAt,
  webhookState,
} from "../webhook-state";

const NOW = Date.parse("2026-10-28T12:00:00Z");
const iso = (daysFromNow: number) => new Date(NOW + daysFromNow * DAY).toISOString();
const key = (over: Partial<Parameters<typeof keyRow>[0]> = {}) =>
  keyRow(
    {
      id: "k1",
      tenant_id: "t1",
      name: "CI deploys",
      prefix: "qk_abcdefgh",
      scopes: ["user.read"],
      created_at: iso(-200),
      ...over,
    },
    NOW,
  );

describe("machine credentials", () => {
  it("words a dated credential: revoked first, then expired, then within 30 days", () => {
    expect(datedStatus(iso(-1), iso(-5), NOW)).toBe("revoked");
    expect(datedStatus(null, iso(-1), NOW)).toBe("expired");
    expect(datedStatus(null, iso(30), NOW)).toBe("expiring");
    expect(datedStatus(null, iso(31), NOW)).toBe("active");
    expect(datedStatus(null, null, NOW)).toBe("active");
  });

  it("says no scopes can call nothing (the server denies a machine any route it has no scope for)", () => {
    expect(reachOf([])).toBe("none");
    expect(reachOf(["user.read", "vault:stripe"])).toBe("read");
    expect(reachOf(["user.read", "user.write"])).toBe("write");
  });

  it("steps a key's last use like the Users band", () => {
    expect(usedOf(null, NOW)).toBe("never");
    expect(usedOf(iso(-0.5), NOW)).toBe("today");
    expect(usedOf(iso(-3), NOW)).toBe("week");
    expect(usedOf(iso(-20), NOW)).toBe("month");
    expect(usedOf(iso(-40), NOW)).toBe("older");
  });

  it("flags what needs a look", () => {
    const none = new Set<string>();
    expect(looksOf(key({ expires_at: iso(-2) }), NOW, none)).toEqual(["expired"]);
    expect(looksOf(key({ last_used_at: iso(-100) }), NOW, none)).toEqual(["unused"]);
    expect(looksOf(key({ last_used_at: iso(-1), scopes: [] }), NOW, none)).toEqual(["noScopes"]);
    // A revoked key is done with: nothing to look at.
    expect(looksOf(key({ revoked_at: iso(-1) }), NOW, none)).toEqual([]);
    const agent = agentRow({
      id: "a1",
      name: "Support Copilot",
      scopes: ["user.read"],
      token_ttl_seconds: 600,
      status: "active",
      disabled: false,
      sponsor_user_id: "u-gone",
      created_at: iso(-10),
    });
    expect(looksOf(agent, NOW, new Set(["u-gone"]))).toEqual(["sponsorGone"]);
  });

  it("filters and sorts: search reaches the sponsor's name, working ones first", () => {
    const rows: Machine[] = [
      key({ id: "old", revoked_at: iso(-1), created_at: iso(-1) }),
      key({ id: "live", name: "Terraform", created_at: iso(-300) }),
    ];
    expect(sortMachines(rows, null).map((m) => m.id)).toEqual(["live", "old"]);
    const named = (id: string) => (id === "u1" ? "Priya Nair" : undefined);
    const personal = key({ id: "mine", user_id: "u1" });
    expect(matches(personal, { q: "priya" }, NOW, new Set(), named)).toBe(true);
    expect(matches(personal, { status: "revoked" }, NOW, new Set(), named)).toBe(false);
  });
});

const hook = (over: Partial<Webhook> = {}): Webhook => ({
  id: "w1",
  tenant_id: "t1",
  url: "https://hooks.acme.in/qeet/events?v=2",
  events: ["user.created", "session.revoked", "group.created"],
  created_at: iso(-90),
  ...over,
});
const delivery = (over: Partial<WebhookDelivery> = {}): WebhookDelivery => ({
  id: "d1",
  event_type: "user.created",
  attempt: 1,
  payload: "{}",
  created_at: iso(-1),
  // The server never clears it, even once delivered or given up.
  next_attempt_at: iso(-1),
  ...over,
});

describe("webhooks", () => {
  it("tells turned off by failures from disabled by someone", () => {
    expect(webhookState(hook({ disabled_at: iso(-1), disabled_reason: "failing" }))).toBe(
      "autoDisabled",
    );
    expect(webhookState(hook({ disabled_at: iso(-1), disabled_reason: "disabled" }))).toBe(
      "disabled",
    );
    expect(webhookState(hook({ failing_since: iso(-1) }))).toBe("failing");
    expect(webhookState(hook())).toBe("active");
  });

  it("turns a failing endpoint off 3 days after it started failing", () => {
    expect(turnsOffAt(hook({ failing_since: iso(-1) }))).toBe(NOW + 2 * DAY);
    expect(turnsOffAt(hook({ failing_since: iso(-1), disabled_at: iso(0) }))).toBeUndefined();
  });

  it("reads the previous secret's overlap only while it lasts (the field is never cleared)", () => {
    expect(overlapUntil(hook({ previous_secret_expires_at: iso(0.5) }), NOW)).toBe(NOW + DAY / 2);
    expect(overlapUntil(hook({ previous_secret_expires_at: iso(-3) }), NOW)).toBeUndefined();
  });

  it("gives each delivery its outcome without trusting next_attempt_at", () => {
    const on = hook();
    expect(outcomeOf(delivery({ delivered_at: iso(-1) }), on)).toBe("delivered");
    expect(outcomeOf(delivery({ dead_at: iso(-1), attempt: 60 }), on)).toBe("gaveUp");
    expect(outcomeOf(delivery({ attempt: 3 }), on)).toBe("retrying");
    expect(outcomeOf(delivery({ attempt: 0 }), on)).toBe("queued");
    expect(outcomeOf(delivery({ attempt: 3 }), hook({ disabled_at: iso(-1) }))).toBe("held");
  });

  it("knows a refusal isn't retried, except 408 and 429", () => {
    expect(notRetried(delivery({ status_code: 410 }))).toBe(true);
    expect(notRetried(delivery({ status_code: 429 }))).toBe(false);
    expect(notRetried(delivery({ status_code: 500 }))).toBe(false);
  });

  it("lays the deliveries out over time in buckets sized to their span, gaps included", () => {
    const list = [
      delivery({ id: "a", created_at: iso(-4), delivered_at: iso(-4) }),
      delivery({ id: "b", created_at: iso(0), dead_at: iso(0) }),
    ];
    const byDay = deliveriesOverTime(list, hook(), NOW);
    expect(byDay.unit).toBe("day");
    expect(byDay.buckets).toHaveLength(5);
    expect(byDay.buckets.map((d) => d.total)).toEqual([1, 0, 0, 0, 1]);
    expect(countOutcomes(list, hook())).toMatchObject({ delivered: 1, gaveUp: 1 });
    // The last 50 of a busy endpoint span minutes: 5-minute buckets.
    const recent = [delivery({ created_at: new Date(NOW - 40 * 60_000).toISOString() })];
    const byMinutes = deliveriesOverTime(recent, hook(), NOW);
    expect(byMinutes.unit).toBe("minutes");
    expect(byMinutes.buckets.length).toBeGreaterThanOrEqual(8);
    expect(byMinutes.buckets.reduce((n, b) => n + b.total, 0)).toBe(1);
  });

  it("names an endpoint by its host and groups its events by area", () => {
    expect(endpointParts("https://hooks.acme.in/qeet/events?v=2")).toEqual({
      host: "hooks.acme.in",
      path: "/qeet/events?v=2",
    });
    expect(eventAreas(hook().events)).toEqual([
      { area: "people", count: 1 },
      { area: "signIn", count: 1 },
      { area: "groups", count: 1 },
    ]);
  });
});
