import { describe, expect, it } from "vitest";

import type { OAuthGrant, OidcClient } from "@/modules/authentication";
import type { ApiKey, Webhook } from "@/modules/developer";
import type { Anomaly } from "@/modules/security";
import { EMPTY_OVERVIEW } from "../api/analytics";
import {
  appsInUse,
  axisScale,
  burstHours,
  deriveOverviewAttention,
  localHour,
} from "../overview-model";
import { deriveSetup, SETUP_ORDER } from "../overview-setup-model";

const NOW = new Date("2026-10-26T16:45:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

const webhook = (id: string, over: Partial<Webhook> = {}): Webhook => ({
  id,
  tenant_id: "t1",
  url: `https://${id}.qeet.in/hook`,
  events: ["user.created"],
  created_at: days(-90),
  ...over,
});

const apiKey = (id: string, over: Partial<ApiKey> = {}): ApiKey => ({
  id,
  tenant_id: "t1",
  name: `Key ${id}`,
  prefix: "qk_",
  scopes: null,
  created_at: days(-60),
  ...over,
});

const anomaly = (id: string, over: Partial<Anomaly> = {}): Anomaly => ({
  id,
  type: "credential_stuffing",
  severity: "high",
  detail: "7 accounts in 15 minutes",
  status: "open",
  created_at: days(-1),
  ...over,
});

describe("deriveOverviewAttention", () => {
  it("puts a webhook its failures turned off first, then open anomalies, failing webhooks and keys", () => {
    const items = deriveOverviewAttention({
      webhooks: [
        webhook("staging", { disabled_at: days(-5), disabled_reason: "failing" }),
        webhook("notify", { failing_since: days(-1) }),
        webhook("admin-off", { disabled_at: days(-3), disabled_reason: "disabled" }),
      ],
      apiKeys: [apiKey("soon", { expires_at: days(5) }), apiKey("later", { expires_at: days(90) })],
      anomalies: [
        anomaly("open"),
        anomaly("done", { status: "resolved", resolved_at: days(0) }),
        anomaly("low", { severity: "low" }),
      ],
      now: NOW,
    });
    expect(items.map((i) => i.id)).toEqual([
      "anomaly-open",
      "webhook-off-staging",
      "webhooks-failing",
      "keys-expiring",
    ]);
    expect(items[0]).toMatchObject({
      severity: "critical",
      params: { type: "Credential stuffing" },
    });
    expect(items.find((i) => i.id === "webhooks-failing")?.params).toMatchObject({
      count: 1,
      hosts: "notify.qeet.in",
    });
    expect(items.find((i) => i.id === "keys-expiring")).toMatchObject({
      severity: "warning",
      params: { days: 5, name: "Key soon" },
    });
  });

  it("adds the analytics signals past their thresholds, and nothing for missing sources", () => {
    const overview = {
      ...EMPTY_OVERVIEW,
      kpis: { ...EMPTY_OVERVIEW.kpis, mfa_adoption_pct: { value: 40, delta_pct: 0 } },
    };
    expect(deriveOverviewAttention({ now: NOW }).length).toBe(0);
    expect(deriveOverviewAttention({ overview, now: NOW }).map((i) => i.id)).toEqual([
      "mfa-adoption",
    ]);
  });

  it("counts two-step coverage from the people themselves when it can, not the analytics estimate", () => {
    const overview = {
      ...EMPTY_OVERVIEW,
      kpis: { ...EMPTY_OVERVIEW.kpis, mfa_adoption_pct: { value: 38.6, delta_pct: 0 } },
    };
    const userStats = {
      total: 45,
      active: 44,
      suspended: 1,
      invited: 0,
      mfa_enabled: 18,
      mfa_missing: 27,
      new_last_30d: 2,
    };
    const items = deriveOverviewAttention({ overview, userStats, now: NOW });
    expect(items.map((i) => i.id)).toEqual(["two-step"]);
    expect(items[0]?.params).toEqual({ have: 18, total: 45, target: 80 });
  });
});

describe("the last 24 hours", () => {
  it("shows the server's UTC hour as the time where the person is", () => {
    expect(localHour("17:00", "en-IN", "Asia/Kolkata")).toBe("22:30");
    expect(localHour("03:00", "en-GB", "UTC")).toBe("03:00");
  });

  it("marks only hours far above the rest as bursts", () => {
    const rows = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      attempts: i === 0 || i === 10 ? 26 : i === 14 ? 2 : 0,
    }));
    expect([...burstHours(rows)]).toEqual([0, 10]);
    expect(burstHours(rows.map((r) => ({ ...r, attempts: 3 }))).size).toBe(0);
  });
});

describe("appsInUse", () => {
  const client = (id: string, name: string): OidcClient => ({
    id,
    tenant_id: "t1",
    client_id: `qci_${id}`,
    name,
    type: "confidential",
    redirect_uris: [],
    grant_types: [],
    scopes: [],
    created_at: days(-100),
  });
  const grant = (clientId: string, userId: string, expiresIn = 30): OAuthGrant => ({
    id: `${clientId}-${userId}`,
    client_id: clientId,
    user_id: userId,
    user_email: `${userId}@qeet.in`,
    scopes: [],
    issued_at: days(-1),
    expires_at: days(expiresIn),
  });

  it("counts distinct people with an active grant, most-used first", () => {
    const { used, unused } = appsInUse(
      [client("logs", "Qeet Logs"), client("pay", "Qeet Pay"), client("example", "Example app")],
      [
        grant("qci_logs", "a"),
        grant("qci_logs", "a"),
        grant("qci_logs", "b"),
        grant("qci_pay", "a"),
        grant("qci_example", "c", -1),
      ],
      NOW,
    );
    expect(used.map((u) => [u.client.name, u.people])).toEqual([
      ["Qeet Logs", 2],
      ["Qeet Pay", 1],
    ]);
    expect(unused.map((c) => c.name)).toEqual(["Example app"]);
  });
});

describe("deriveSetup", () => {
  it("names each item's state, and gives an action only to the ones that need something", () => {
    const groups = deriveSetup({
      saml: [{ id: "s", name: "Google Workspace", status: "active" } as never],
      methods: ["Passkey", "Password"],
      userStats: {
        total: 45,
        active: 44,
        suspended: 1,
        invited: 0,
        mfa_enabled: 18,
        mfa_missing: 27,
        new_last_30d: 2,
      },
      pendingInvites: 2,
      domains: [{ id: "d", domain: "qeet.in", status: "verified" } as never],
      scim: { token_set: false, created_at: null, last_used_at: null, provisioned_count: 0 },
      ldap: [
        { id: "l", name: "Staging Directory", status: "draft", created_at: days(-18) } as never,
      ],
      apiKeys: [apiKey("soon", { expires_at: days(5) })],
      webhooks: [webhook("staging", { disabled_at: days(-5), disabled_reason: "failing" })],
      now: NOW,
    });
    const state = Object.fromEntries(groups.flatMap((g) => g.items.map((i) => [i.id, i.state])));
    expect(state).toEqual({
      sso: "done",
      methods: "done",
      twoStep: "attention",
      team: "done",
      domain: "done",
      scim: "none",
      ldap: "setup",
      apiKeys: "attention",
      webhooks: "failing",
    });
    const items = groups.flatMap((g) => g.items);
    expect(items.filter((i) => i.state === "done").every((i) => !i.action)).toBe(true);
    expect(items.filter((i) => i.state !== "done").every((i) => i.action)).toBe(true);
  });

  it("leaves out what it can't read, and a group with nothing in it", () => {
    const groups = deriveSetup({ apiKeys: [], now: NOW });
    expect(groups.map((g) => g.id)).toEqual(["developers"]);
    expect(groups[0]?.items).toMatchObject([{ id: "apiKeys", state: "none" }]);
  });

  it("reads as progress: done first, then what needs you", () => {
    expect(SETUP_ORDER).toEqual(["done", "failing", "attention", "setup", "none"]);
  });
});

describe("axisScale", () => {
  it("counts from zero in whole, round steps", () => {
    expect(axisScale(68)).toEqual({ top: 80, ticks: [0, 20, 40, 60, 80] });
    expect(axisScale(43)).toEqual({ top: 50, ticks: [0, 10, 20, 30, 40, 50] });
    expect(axisScale(0)).toEqual({ top: 10, ticks: [0, 2, 4, 6, 8, 10] });
    expect(axisScale(1240)).toEqual({ top: 1500, ticks: [0, 500, 1000, 1500] });
  });
});
