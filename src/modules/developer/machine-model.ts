// Machine access: API keys, machine identities and agents as one kind of record, a "machine
// credential", so the four tabs share one list, one status vocabulary and one band. Pure functions;
// the components word them (developer:status.*, developer:machine.*).

import type { Agent } from "./api/agents";
import type { ApiKey } from "./api/api-keys";
import type { ServicePrincipal } from "./api/service-principals";

export const DAY = 86_400_000;
/** "Expires soon" is within this many days (§2 of the redesign findings, as the Dashboard counts). */
export const EXPIRING_DAYS = 30;
/** A live key not used for this long is worth a look: something may hold it that nobody runs. */
export const UNUSED_DAYS = 90;

export const MACHINE_KINDS = ["key", "identity", "agent"] as const;
export type MachineKind = (typeof MACHINE_KINDS)[number];

/** One status vocabulary for every credential: the word carries it, the tone repeats it. */
export const CRED_STATUSES = [
  "active",
  "expiring",
  "expired",
  "revoked",
  "disabled",
  "suspended",
] as const;
export type CredStatus = (typeof CRED_STATUSES)[number];
/** No longer working, by someone's hand: revoked, disabled or suspended. */
export const OFF_STATUSES: readonly CredStatus[] = ["revoked", "disabled", "suspended"];

/** When a live key was last used: the Users band's recency steps. */
export const USED = ["today", "week", "month", "older", "never"] as const;
export type Used = (typeof USED)[number];

/** What a credential's scopes let it do: read only, change something, or nothing at all. */
export const REACH = ["read", "write", "none"] as const;
export type Reach = (typeof REACH)[number];

export const MACHINE_LOOKS = [
  "expired",
  "expiring",
  "unused",
  "noScopes",
  "suspended",
  "sponsorGone",
] as const;
export type MachineLook = (typeof MACHINE_LOOKS)[number];

export type Machine = {
  kind: MachineKind;
  id: string;
  name: string;
  /** What people match it by: a key's prefix, an identity's client ID, an agent's ID. */
  ident: string;
  scopes: string[];
  /** The person it belongs to (a personal key) or who answers for it (an agent's sponsor). */
  personId: string | null;
  /** Recorded for API keys only; the server keeps none for identities or agents. */
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  status: CredStatus;
  /** An agent's token lifetime, in seconds. */
  ttl?: number;
};

export type MachineFilters = {
  q?: string;
  kind?: MachineKind;
  status?: CredStatus;
  used?: Used;
  reach?: Reach;
  sponsor?: string;
  look?: MachineLook;
};

/** A dated credential's status: revoked, expired, expiring within 30 days, or fine. */
export function datedStatus(
  revokedAt: string | null | undefined,
  expiresAt: string | null | undefined,
  now: number,
): CredStatus {
  if (revokedAt) return "revoked";
  if (expiresAt) {
    const left = Date.parse(expiresAt) - now;
    if (left <= 0) return "expired";
    if (left <= EXPIRING_DAYS * DAY) return "expiring";
  }
  return "active";
}

export function keyRow(k: ApiKey, now: number): Machine {
  return {
    kind: "key",
    id: k.id,
    name: k.name,
    ident: k.prefix,
    scopes: k.scopes ?? [],
    personId: k.user_id ?? null,
    lastUsedAt: k.last_used_at ?? null,
    expiresAt: k.expires_at ?? null,
    createdAt: k.created_at,
    status: datedStatus(k.revoked_at, k.expires_at, now),
  };
}

export function identityRow(p: ServicePrincipal): Machine {
  return {
    kind: "identity",
    id: p.id,
    name: p.name,
    ident: p.id, // its client ID is its ID
    scopes: p.scopes ?? [],
    personId: null,
    lastUsedAt: null,
    expiresAt: null,
    createdAt: p.created_at,
    status: p.disabled_at ? "disabled" : "active",
  };
}

export function agentRow(a: Agent): Machine {
  return {
    kind: "agent",
    id: a.id,
    name: a.name,
    ident: a.id,
    scopes: a.scopes ?? [],
    personId: a.sponsor_user_id ?? null,
    lastUsedAt: null,
    expiresAt: null,
    createdAt: a.created_at,
    // The list hides decommissioned agents; one that slips through reads as off.
    status: a.status === "active" ? "active" : a.status === "suspended" ? "suspended" : "disabled",
    ttl: a.token_ttl_seconds,
  };
}

/** Whether it still works: not revoked, disabled, suspended or expired. */
export const isLive = (m: Machine) => m.status === "active" || m.status === "expiring";

export function usedOf(lastUsedAt: string | null, now: number): Used {
  if (!lastUsedAt) return "never";
  const age = now - Date.parse(lastUsedAt);
  if (age < DAY) return "today";
  if (age < 7 * DAY) return "week";
  if (age < 30 * DAY) return "month";
  return "older";
}

/**
 * What the scopes reach. The server denies a machine any route none of its scopes matches, so no
 * scopes means it can call nothing (not full access). `vault:` scopes read secrets.
 */
export function reachOf(scopes: readonly string[]): Reach {
  if (!scopes.length) return "none";
  return scopes.every((s) => s.endsWith(".read") || s.startsWith("vault:")) ? "read" : "write";
}

/** Whether it needs a look, and why; `gone` holds the sponsors who can no longer answer for one. */
export function looksOf(m: Machine, now: number, gone: ReadonlySet<string>): MachineLook[] {
  const out: MachineLook[] = [];
  if (m.status === "expired") out.push("expired");
  if (m.status === "expiring") out.push("expiring");
  if (
    m.kind === "key" &&
    isLive(m) &&
    (m.lastUsedAt
      ? now - Date.parse(m.lastUsedAt) > UNUSED_DAYS * DAY
      : now - Date.parse(m.createdAt) > UNUSED_DAYS * DAY)
  )
    out.push("unused");
  if (isLive(m) && !m.scopes.length) out.push("noScopes");
  if (m.status === "suspended") out.push("suspended");
  if (m.kind === "agent" && m.personId && gone.has(m.personId) && m.status !== "disabled")
    out.push("sponsorGone");
  return out;
}

export function matches(
  m: Machine,
  f: MachineFilters,
  now: number,
  gone: ReadonlySet<string>,
  personName: (id: string) => string | undefined,
): boolean {
  if (f.kind && m.kind !== f.kind) return false;
  if (f.status && m.status !== f.status) return false;
  if (f.used && (m.kind !== "key" || !isLive(m) || usedOf(m.lastUsedAt, now) !== f.used))
    return false;
  if (f.reach && reachOf(m.scopes) !== f.reach) return false;
  if (f.sponsor && m.personId !== f.sponsor) return false;
  if (f.look && !looksOf(m, now, gone).includes(f.look)) return false;
  const q = f.q?.trim().toLowerCase();
  if (q) {
    const person = m.personId ? personName(m.personId) : undefined;
    const hay = [m.name, m.ident, ...m.scopes, person ?? ""].join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/** Sorts live ones first, then by the column; ties newest first. */
export function sortMachines(
  rows: readonly Machine[],
  sort: { column: string; direction: "ascending" | "descending" } | null,
): Machine[] {
  const dir = sort?.direction === "descending" ? -1 : 1;
  const time = (iso: string | null, missing: number) => (iso ? Date.parse(iso) : missing);
  const by: Record<string, (a: Machine, b: Machine) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    kind: (a, b) => MACHINE_KINDS.indexOf(a.kind) - MACHINE_KINDS.indexOf(b.kind),
    used: (a, b) => time(a.lastUsedAt, 0) - time(b.lastUsedAt, 0),
    expires: (a, b) =>
      time(a.expiresAt, Number.MAX_SAFE_INTEGER) - time(b.expiresAt, Number.MAX_SAFE_INTEGER),
    created: (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  };
  const compare = sort ? by[sort.column] : undefined;
  return [...rows].sort((a, b) => {
    if (compare) return compare(a, b) * dir || Date.parse(b.createdAt) - Date.parse(a.createdAt);
    const live = Number(isLive(b)) - Number(isLive(a));
    return live || Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

/** How many of `rows` fall in each value of `of`, in `values` order. */
export function countBy<T extends string>(
  rows: readonly Machine[],
  values: readonly T[],
  of: (m: Machine) => T | undefined,
): { id: T; count: number }[] {
  return values.map((id) => ({ id, count: rows.filter((m) => of(m) === id).length }));
}

/** Created per month, the last `months` of them, oldest first: for the band's sparkline. */
export function createdByMonth(dates: readonly string[], now: number, months: number): number[] {
  const end = new Date(now);
  const out = new Array<number>(months).fill(0);
  for (const iso of dates) {
    const d = new Date(iso);
    const back = (end.getFullYear() - d.getFullYear()) * 12 + end.getMonth() - d.getMonth();
    if (back >= 0 && back < months) out[months - 1 - back] = (out[months - 1 - back] ?? 0) + 1;
  }
  return out;
}

/** Agents' token lifetimes, in the create drawer's steps. */
export const TTL_STEPS = ["short", "medium", "long"] as const;
export type TtlStep = (typeof TTL_STEPS)[number];
export const ttlStep = (seconds: number): TtlStep =>
  seconds <= 600 ? "short" : seconds <= 1800 ? "medium" : "long";
