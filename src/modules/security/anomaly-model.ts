// Sign-in anomalies as the Anomalies list reads them: what each tells (from its metadata, the
// server's internal/access/threat/threat), how the list filters, and the band's counts. The
// server returns the latest 50 and no total but the summary's.

import { type Anomaly, isAnomalyResolved } from "./api/anomalies";

export const ANOMALY_TYPES = ["credential_stuffing", "password_spraying"] as const;
export type AnomalyType = (typeof ANOMALY_TYPES)[number];
export const ANOMALY_STATUSES = ["open", "resolved"] as const;
export type AnomalyStatus = (typeof ANOMALY_STATUSES)[number];

/** The list's address: `?q=…&status=open&type=password_spraying`. */
export type AnomalyFilters = { q?: string; status?: AnomalyStatus; type?: AnomalyType };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : undefined);

/**
 * What the detection counted, from its metadata: the failures, the accounts tried, the window,
 * the networks, and when its lock or throttle ends. `counter` says which count tripped: one
 * network against one account ("account_network"), one account from anywhere ("account"), or
 * one network against many accounts ("source").
 */
export function anomalyFacts(a: Anomaly) {
  const m = a.metadata ?? {};
  return {
    counter: str(m.counter),
    failures: num(m.failures),
    accounts: num(m.distinct_accounts),
    windowMinutes: num(m.window_minutes),
    networks: num(m.networks),
    network: str(m.network) ?? a.ip ?? undefined,
    until: str(m.locked_until) ?? str(m.throttled_until),
    throttled: !!str(m.throttled_until),
  };
}

/**
 * The single network it came from, the one a deny rule could name: none when the count was for
 * one account from several networks.
 */
export function sourceAddress(a: Anomaly): string | undefined {
  const f = anomalyFacts(a);
  if (f.counter === "account" || (f.networks ?? 1) > 1) return undefined;
  return f.network;
}

export function isType(type: string): type is AnomalyType {
  return (ANOMALY_TYPES as readonly string[]).includes(type);
}

export function matches(a: Anomaly, filters: AnomalyFilters): boolean {
  if (filters.status === "open" && isAnomalyResolved(a)) return false;
  if (filters.status === "resolved" && !isAnomalyResolved(a)) return false;
  if (filters.type && a.type !== filters.type) return false;
  const q = filters.q?.trim().toLowerCase();
  if (q) {
    const hay = [a.user_email, a.ip, anomalyFacts(a).network].filter(Boolean).join(" ");
    if (!hay.toLowerCase().includes(q)) return false;
  }
  return true;
}

export function isFiltered(filters: AnomalyFilters): boolean {
  return !!(filters.q || filters.status || filters.type);
}

const DAY = 24 * 60 * 60 * 1000;

/** Detections a day over the last `days`, oldest first, for the band's sparkline. */
export function perDay(items: readonly Anomaly[], now: number, days = 30): number[] {
  const out = Array<number>(days).fill(0);
  for (const a of items) {
    const age = Math.floor((now - Date.parse(a.created_at)) / DAY);
    if (age >= 0 && age < days) out[days - 1 - age] = (out[days - 1 - age] ?? 0) + 1;
  }
  return out;
}

/** The addresses seen most, with how many anomalies came from each. */
export function topSources(items: readonly Anomaly[], limit = 3) {
  const counts = new Map<string, number>();
  for (const a of items) {
    const ip = anomalyFacts(a).network;
    if (ip) counts.set(ip, (counts.get(ip) ?? 0) + 1);
  }
  return [...counts]
    .map(([ip, count]) => ({ ip, count }))
    .sort((x, y) => y.count - x.count || x.ip.localeCompare(y.ip))
    .slice(0, limit);
}
