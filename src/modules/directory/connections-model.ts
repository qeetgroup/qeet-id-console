// Directory › Directories › Connections: its rules, pure so the page and its tests share them.
// A connection is the organisation's one SCIM endpoint (listed once it has a token) or one of its
// LDAP servers; its health is the server's (the latest event, "unknown" past 24 hours).

import type { DirectoryEvent } from "./api/directory";
import type { ConnectionsFilters } from "./connections-search";
import type { DirectoryConnection } from "./directory-model";

const DAY = 86_400_000;
export const DAYS = 30;

/** Health in the page's three words: healthy, failing, or not checked in the last 24 hours. */
export type HealthState = "healthy" | "failing" | "unchecked";
export function healthState(connection: DirectoryConnection): HealthState {
  if (connection.health === "healthy") return "healthy";
  if (connection.health === "failed" || connection.health === "warning") return "failing";
  return "unchecked";
}

export function healthCounts(connections: readonly DirectoryConnection[]) {
  const counts: Record<HealthState, number> = { healthy: 0, failing: 0, unchecked: 0 };
  for (const c of connections) counts[healthState(c)]++;
  return counts;
}

/**
 * Where the organisation's people come from: SCIM's, LDAP's (null while the server doesn't count
 * them, QTID-964) and the rest, managed in Qeet ID.
 */
export function peopleSources(connections: readonly DirectoryConnection[], total: number) {
  const scim = connections.find((c) => c.type === "scim")?.userCount ?? 0;
  const ldapCounts = connections.filter((c) => c.type === "ldap").map((c) => c.userCount);
  const ldap = ldapCounts.some((count) => count !== null)
    ? ldapCounts.reduce<number>((sum, count) => sum + (count ?? 0), 0)
    : null;
  const fromDirectories = scim + (ldap ?? 0);
  return { scim, ldap, fromDirectories, here: Math.max(0, total - fromDirectories) };
}

/** Each connection's latest open problem, from the open errors (newest first). */
export function latestProblems(errors: readonly DirectoryEvent[]): Map<string, DirectoryEvent> {
  const out = new Map<string, DirectoryEvent>();
  for (const e of [...errors].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at)))
    if (!out.has(e.connection_id)) out.set(e.connection_id, e);
  return out;
}

/** The problem in plain words: the server's message without the address it starts with. */
export const problemText = (event: Pick<DirectoryEvent, "message">) =>
  event.message.split(": ").pop() ?? event.message;

/**
 * The last DAYS days, oldest first: the people and groups synced each day (the server's volume)
 * and the events that failed.
 */
export function dailyColumns(
  volume: readonly { date: string; users: number; groups: number }[],
  failed: readonly Pick<DirectoryEvent, "started_at">[],
  now: number,
): { date: string; changes: number; failed: number }[] {
  const byDate = new Map(volume.map((v) => [v.date, v.users + v.groups]));
  const failures = new Map<string, number>();
  for (const e of failed) {
    const date = new Date(e.started_at).toISOString().slice(0, 10);
    failures.set(date, (failures.get(date) ?? 0) + 1);
  }
  return Array.from({ length: DAYS }, (_, i) => {
    const date = new Date(now - (DAYS - 1 - i) * DAY).toISOString().slice(0, 10);
    return { date, changes: byDate.get(date) ?? 0, failed: failures.get(date) ?? 0 };
  });
}

/** The kinds not set up yet, for the offers under the table. */
export function missingKinds(connections: readonly DirectoryConnection[]): ("scim" | "ldap")[] {
  return (["scim", "ldap"] as const).filter((kind) => !connections.some((c) => c.type === kind));
}

/** Whether a connection is one the address shows. */
export function shownConnection(c: DirectoryConnection, filters: ConnectionsFilters): boolean {
  if (filters.show === "failing") return healthState(c) === "failing";
  if (filters.show === "draft") return c.status === "draft";
  return true;
}

/** The host a connection's server address names, for the confirms: "ldap.staging.qeet.in". */
export function hostOf(serverUrl: string | null): string {
  if (!serverUrl) return "";
  try {
    return new URL(serverUrl).hostname || serverUrl;
  } catch {
    return serverUrl;
  }
}
