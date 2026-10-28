// The Organisations list's and an organisation's page's rules, pure so the pages and their tests
// share them. The list is the caller's organisations (GET /v1/tenants) joined with their place in
// each (GET /v1/me/organizations: roles, last opened, domain); an organisation's history is the
// audit events on the organisation itself.

import type { TableSort } from "@qeetrix/react";

import type { EligibleOrganization } from "@/platform/auth/organization-selection";
import type { Org, OrgAuditEvent } from "./api/orgs";
import { ORG_LOOKS, type OrgFilters, type OrgLook } from "./orgs-search";

const DAY = 86_400_000;

/** An organisation not opened for this long needs a look. */
export const STALE_DAYS = 30;
/** The days between asking to delete an organisation and its deletion (the server's grace). */
export const DELETION_GRACE_DAYS = 7;

export const PLANS = ["enterprise", "pro", "starter", "free"] as const;
export { ORG_LOOKS, type OrgFilters, type OrgLook, orgsListSearch } from "./orgs-search";

/**
 * What a reading needs besides the rows: now, and the two-step target (the Users band's, passed in
 * so this file stays light for the route).
 */
export type OrgReading = { now: number; target: number };

export type OrgRow = Org & {
  /** The caller's roles in it, strongest first; empty when it isn't open to them. */
  roles: string[];
  /** Its verified domain, if any. */
  domain: string;
  /** When the caller last opened it. */
  lastUsedAt: string | null;
  /** The organisation the caller is in now. */
  current: boolean;
};

const RANK = ["owner", "admin"];
const rank = (role: string) => {
  const at = RANK.indexOf(role.toLowerCase());
  return at < 0 ? RANK.length : at;
};
/** Roles strongest first: owner, then admin, then the rest by name. */
export function byRank(roles: readonly string[]): string[] {
  return [...roles].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
/** The caller's strongest role, as shown: "Owner", "Admin", "Security analyst". */
export function roleOf(row: Pick<OrgRow, "roles">): string | null {
  const top = row.roles[0];
  return top ? top.charAt(0).toUpperCase() + top.slice(1) : null;
}
export const isOwner = (row: Pick<OrgRow, "roles">) =>
  row.roles.some((r) => r.toLowerCase() === "owner");

/** The caller's organisations, each with their place in it; the current one's record on top. */
export function orgRows(
  tenants: readonly Org[],
  memberships: readonly EligibleOrganization[] | undefined,
  currentId: string | null,
  record?: Org | null,
): OrgRow[] {
  const mine = new Map((memberships ?? []).map((m) => [m.id, m]));
  return tenants.map((org) => {
    const m = mine.get(org.id);
    const current = org.id === currentId;
    return {
      ...org,
      ...(current && record ? { deletion_due_at: record.deletion_due_at } : {}),
      roles: byRank(m?.roles ?? []),
      domain: m?.domain ?? "",
      lastUsedAt: m?.last_used_at ?? null,
      current,
    };
  });
}

/** Two-step coverage, 0–100: its members who use two-step. */
export function twoStepShare(org: Pick<Org, "member_count" | "mfa_enabled_count">): number {
  const members = org.member_count ?? 0;
  return members ? Math.round(((org.mfa_enabled_count ?? 0) / members) * 100) : 0;
}
export const belowTarget = (row: OrgRow, target: number) =>
  row.status === "active" && (row.member_count ?? 0) > 0 && twoStepShare(row) < target;
/** Not opened in STALE_DAYS (or never); the one you're in never is. */
export const isStale = (row: OrgRow, now: number) =>
  !row.current && (!row.lastUsedAt || now - Date.parse(row.lastUsedAt) > STALE_DAYS * DAY);

export function matchesLook(row: OrgRow, look: OrgLook, { now, target }: OrgReading): boolean {
  if (look === "below-target") return belowTarget(row, target);
  if (look === "stale") return isStale(row, now);
  if (look === "suspended") return row.status === "suspended";
  return !!row.deletion_due_at;
}

/** Whether a row is one the search and filters leave. */
export function matchesOrg(row: OrgRow, filters: OrgFilters, reading: OrgReading): boolean {
  const query = filters.q?.trim().toLowerCase();
  if (query && !`${row.name} ${row.slug} ${row.domain}`.toLowerCase().includes(query)) return false;
  if (filters.role && roleOf(row)?.toLowerCase() !== filters.role.toLowerCase()) return false;
  if (filters.plan && row.plan !== filters.plan) return false;
  if (filters.region && row.region !== filters.region) return false;
  if (filters.look && !matchesLook(row, filters.look, reading)) return false;
  return true;
}

export const isFiltered = (filters: OrgFilters) =>
  !!(filters.q?.trim() || filters.role || filters.plan || filters.region || filters.look);

export type OrgSortColumn = "name" | "members" | "twostep" | "opened";
const SORT_VALUE: Record<OrgSortColumn, (row: OrgRow, now: number) => string | number> = {
  name: (row) => row.name.toLowerCase(),
  members: (row) => row.member_count ?? 0,
  twostep: (row) => twoStepShare(row),
  // The one you're in counts as opened now; never opened sorts last.
  opened: (row, now) => (row.current ? now : row.lastUsedAt ? Date.parse(row.lastUsedAt) : 0),
};

/** The rows the filters leave, in the sort (by name until one is chosen). */
export function visibleOrgs(
  rows: readonly OrgRow[],
  filters: OrgFilters,
  sort: TableSort | null,
  reading: OrgReading,
): OrgRow[] {
  const by = sort ?? { column: "name", direction: "ascending" };
  const value = SORT_VALUE[by.column as OrgSortColumn] ?? SORT_VALUE.name;
  const way = by.direction === "ascending" ? 1 : -1;
  return rows
    .filter((row) => matchesOrg(row, filters, reading))
    .sort((a, b) => {
      const x = value(a, reading.now);
      const y = value(b, reading.now);
      return (x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name)) * way;
    });
}

/** How many of each look there are, for the band. */
export function lookCounts(rows: readonly OrgRow[], reading: OrgReading): Record<OrgLook, number> {
  return Object.fromEntries(
    ORG_LOOKS.map((look) => [look, rows.filter((row) => matchesLook(row, look, reading)).length]),
  ) as Record<OrgLook, number>;
}

/** The roles the caller holds across the list, strongest first, with how many of each. */
export function roleCounts(rows: readonly OrgRow[]): { role: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const role = roleOf(row);
    if (role) counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  return byRank([...counts.keys()]).map((role) => ({ role, count: counts.get(role) ?? 0 }));
}

// ── An organisation's history ────────────────────────────────────────────────────────────────

/** The changes to the organisation itself that History names, and the events it leaves out. */
export const CHANGE_KINDS = [
  "tenant.created",
  "tenant.updated",
  "tenant.deletion_scheduled",
  "tenant.deletion_cancelled",
  "tenant.suspended",
  "tenant.reactivated",
  "branding.updated",
  "security_policy.updated",
  "rate_limits.updated",
  "rate_limits.deleted",
  "agent.kill_switch",
  "user.bulk_imported",
] as const;
/** On the organisation, but not a change to it: a refused social sign-up. */
const NOT_A_CHANGE = new Set(["social.signup_refused"]);

/** The changes to it, newest first. */
export function changesOf(events: readonly OrgAuditEvent[]): OrgAuditEvent[] {
  return events
    .filter((e) => !NOT_A_CHANGE.has(e.action))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/** One entry a month from the month it was made to now, with how many changes each had. */
export function changesByMonth(
  changes: readonly OrgAuditEvent[],
  since: string,
  now: number,
): { month: Date; count: number }[] {
  const start = monthKey(new Date(since));
  const end = Math.max(start, monthKey(new Date(now)));
  const counts = new Map<number, number>();
  for (const c of changes) {
    const key = monthKey(new Date(c.created_at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => {
    const key = start + i;
    return { month: new Date(Math.floor(key / 12), key % 12, 1), count: counts.get(key) ?? 0 };
  });
}

/** The strip's shade for a month's changes: none, one, a few, many. */
export const monthLevel = (count: number) =>
  count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : 3;

/** The Activity page at one event (its day loaded, its record open). */
export function activityAt(event: Pick<OrgAuditEvent, "id" | "created_at">) {
  const day = new Date(event.created_at);
  const from = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  return {
    range: "custom",
    from: from.toISOString(),
    to: new Date(from.getTime() + DAY - 1).toISOString(),
    event: event.id,
  };
}

/** The Activity page at every change to the organisation since it was made. */
export function activitySince(created: string, now: number) {
  return { range: "custom", from: created, to: new Date(now).toISOString(), resource: "tenant" };
}

/** When a deletion asked for now takes effect. */
export const deletionDue = (now: number) => new Date(now + DELETION_GRACE_DAYS * DAY);
