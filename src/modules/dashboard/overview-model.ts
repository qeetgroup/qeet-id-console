// The Overview's pure parts: what needs attention, the failed-sign-in bursts, chart axes and which
// apps people use (the set-up checklist is overview-setup-model.ts). Each takes API data and
// returns catalogue keys with their values, so the panels translate at render (as
// dashboard-insights.ts does). Missing data — a source the person can't read, or one still
// loading — is `undefined` and drops out.

import type { OAuthGrant, OidcClient } from "@/modules/authentication";
import type { ApiKey, Webhook } from "@/modules/developer";
import type { Anomaly } from "@/modules/security";
import type { UserStats } from "@/modules/users";
import type { AnalyticsOverview, HourlyPoint } from "./api/analytics";
import { type AttentionItem, deriveAttentionItems, MFA_TARGET_PCT } from "./dashboard-insights";

export { MFA_TARGET_PCT };

export const DAY_MS = 86_400_000;
/** A key "expires soon" within this many days (the console's shared status words). */
export const KEY_EXPIRY_SOON_DAYS = 30;

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

// ── Needs attention ─────────────────────────────────────────────────────────────────────────

export interface OverviewAttention extends AttentionItem {
  /** When the signal started, for ordering within a severity and the "when" in its detail. */
  since?: string;
}

const RANK: Record<AttentionItem["severity"], number> = { critical: 0, warning: 1, info: 2 };

/** Open anomalies a person should look at: unresolved, and not merely informational. */
function isOpenAnomaly(a: Anomaly): boolean {
  return !a.resolved_at && a.status !== "resolved" && a.status !== "dismissed";
}

/** "credential_stuffing" → "Credential stuffing": the server's anomaly type, read as words. */
export function anomalyTypeWords(type: string): string {
  const words = type.replace(/[._]/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : type;
}

/**
 * Everything that needs someone, most severe first: a webhook its failures turned off, open
 * high-risk anomalies, failing webhooks, keys about to expire, and the analytics signals past their
 * thresholds (two-step coverage, a rise in failed sign-ins).
 */
export function deriveOverviewAttention(input: {
  overview?: AnalyticsOverview;
  webhooks?: Webhook[];
  apiKeys?: ApiKey[];
  anomalies?: Anomaly[];
  /** Two-step coverage from the people themselves, so it matches the rest of the page. */
  userStats?: UserStats;
  now?: Date;
}): OverviewAttention[] {
  const now = input.now ?? new Date();
  const items: OverviewAttention[] = [];

  for (const hook of input.webhooks ?? []) {
    if (hook.disabled_at && hook.disabled_reason === "failing") {
      items.push({
        id: `webhook-off-${hook.id}`,
        severity: "critical",
        title: "dashboard:overview.attention.webhookOff.title",
        detail: "dashboard:overview.attention.webhookOff.detail",
        params: { host: hostOf(hook.url) },
        to: `/developer/webhooks/${hook.id}`,
        actionLabel: "dashboard:overview.attention.webhookOff.action",
        since: hook.disabled_at,
      });
    }
  }
  const failing = (input.webhooks ?? []).filter((h) => !h.disabled_at && h.failing_since);
  if (failing.length) {
    items.push({
      id: "webhooks-failing",
      severity: "warning",
      title: "dashboard:overview.attention.webhooksFailing.title",
      detail: "dashboard:overview.attention.webhooksFailing.detail",
      params: { count: failing.length, hosts: failing.map((h) => hostOf(h.url)).join(" · ") },
      to: "/developer/webhooks",
      actionLabel: "dashboard:overview.attention.webhooksFailing.action",
      since: failing.map((h) => h.failing_since ?? "").sort()[0],
    });
  }

  for (const anomaly of (input.anomalies ?? []).filter(isOpenAnomaly)) {
    const severity = anomaly.severity.toLowerCase();
    if (severity !== "high" && severity !== "critical" && severity !== "medium") continue;
    items.push({
      id: `anomaly-${anomaly.id}`,
      severity: severity === "medium" ? "warning" : "critical",
      title: "dashboard:overview.attention.anomaly.title",
      detail: anomaly.ip
        ? "dashboard:overview.attention.anomaly.detailFrom"
        : "dashboard:overview.attention.anomaly.detail",
      params: {
        type: anomalyTypeWords(anomaly.type),
        detail: anomaly.detail,
        ip: anomaly.ip ?? "",
      },
      to: "/security/threats/anomalies",
      actionLabel: "dashboard:overview.attention.anomaly.action",
      since: anomaly.created_at,
    });
  }

  const soon = (input.apiKeys ?? [])
    .filter((k) => !k.revoked_at && k.expires_at)
    .map((k) => ({
      key: k,
      days: (new Date(k.expires_at as string).getTime() - now.getTime()) / DAY_MS,
    }))
    .filter((k) => k.days >= 0 && k.days <= KEY_EXPIRY_SOON_DAYS)
    .sort((a, b) => a.days - b.days);
  const first = soon[0];
  if (first) {
    items.push({
      id: "keys-expiring",
      severity: first.days <= 7 ? "warning" : "info",
      title: "dashboard:overview.attention.keysExpiring.title",
      detail: "dashboard:overview.attention.keysExpiring.detail",
      params: {
        count: soon.length,
        days: Math.max(1, Math.ceil(first.days)),
        name: first.key.name,
      },
      to: "/auth/api/keys",
      actionLabel: "dashboard:overview.attention.keysExpiring.action",
    });
  }

  const stats = input.userStats;
  if (stats && stats.total > 0) {
    const have = Math.round((stats.mfa_enabled / stats.total) * 100);
    if (have < MFA_TARGET_PCT)
      items.push({
        id: "two-step",
        severity: "warning",
        title: "dashboard:overview.attention.twoStep.title",
        detail: "dashboard:overview.attention.twoStep.detail",
        params: { have: stats.mfa_enabled, total: stats.total, target: MFA_TARGET_PCT },
        to: "/settings/organization/security-policy",
        actionLabel: "dashboard:overview.attention.twoStep.action",
      });
  }
  if (input.overview)
    items.push(
      // With the people's own count, the analytics estimate of two-step coverage would contradict it.
      ...deriveAttentionItems(input.overview).filter((i) => !(stats && i.id === "mfa-adoption")),
    );

  return items.sort(
    (a, b) => RANK[a.severity] - RANK[b.severity] || (b.since ?? "").localeCompare(a.since ?? ""),
  );
}

// ── Failed sign-ins, hour by hour ───────────────────────────────────────────────────────────

/** "17:00" (the server's UTC hour) as a time of day where the person is, e.g. "22:30" in IST. */
export function localHour(utcHour: string, locale: string, timeZone?: string): string {
  const [h, m] = utcHour.split(":").map(Number);
  if (!Number.isFinite(h)) return utcHour;
  const at = new Date(Date.UTC(2000, 0, 1, h, Number.isFinite(m) ? m : 0));
  return at.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  });
}

/** A burst is an hour far above the rest: at least 10 failures and three times the hourly mean. */
export function burstHours(rows: HourlyPoint[]): Set<number> {
  const total = rows.reduce((n, r) => n + r.attempts, 0);
  const mean = rows.length ? total / rows.length : 0;
  const floor = Math.max(10, mean * 3);
  return new Set(rows.flatMap((r, i) => (r.attempts >= floor ? [i] : [])));
}

// ── Chart axes ──────────────────────────────────────────────────────────────────────────────

/**
 * A value axis for counts: from zero in whole, round steps of 1, 2 or 5 (×10ⁿ), the smallest that
 * reaches the top in at most five steps — 0 · 10 · 20 · 30 · 40 · 50 for 43. At least 10 high.
 */
export function axisScale(max: number): { top: number; ticks: number[] } {
  const m = Math.max(10, max);
  const base = 10 ** Math.floor(Math.log10(m / 6));
  const step =
    [1, 2, 5, 10, 20, 50].map((k) => k * base).find((s) => Math.ceil(m / s) <= 5) ?? base * 100;
  const top = Math.ceil(m / step) * step;
  return { top, ticks: Array.from({ length: top / step + 1 }, (_, i) => i * step) };
}

// ── Applications people use ─────────────────────────────────────────────────────────────────

export interface AppUse {
  client: OidcClient;
  people: number;
}

/** Each application with the distinct people holding an active grant for it, most-used first. */
export function appsInUse(
  clients: OidcClient[],
  grants: OAuthGrant[],
  now = new Date(),
): { used: AppUse[]; unused: OidcClient[] } {
  const people = new Map<string, Set<string>>();
  for (const g of grants) {
    if (new Date(g.expires_at).getTime() <= now.getTime()) continue;
    const set = people.get(g.client_id) ?? new Set<string>();
    set.add(g.user_id);
    people.set(g.client_id, set);
  }
  const all = clients.map((client) => ({
    client,
    people: people.get(client.client_id)?.size ?? 0,
  }));
  return {
    used: all.filter((a) => a.people > 0).sort((a, b) => b.people - a.people),
    unused: all.filter((a) => a.people === 0).map((a) => a.client),
  };
}
