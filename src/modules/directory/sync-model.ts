// Directories › Sync activity and Sync errors: their rules, pure so the pages and their tests share
// them. Every event is one SCIM change (a person or group added, replaced, updated or removed), one
// sign-in through LDAP, or one LDAP connection check; a failure is an event that didn't succeed.
//
// The server classes a failure only by its HTTP status (classifyOperation): an LDAP check that
// fails is 502, an LDAP sign-in that fails is 401 whatever the reason, a SCIM change keeps the
// status Qeet ID answered. It keeps no finer cause (the message is generic), so a cause here is the
// connection's kind, the operation and that status.

import type { DirectoryEvent } from "./api/directory";
import type { DirectoryConnection } from "./directory-model";

/** Why a failure happened, as an administrator would say it, and so what to do about it. */
export const CAUSES = [
  "unreachable", // an LDAP check: Qeet ID couldn't connect to the server or sign in to it
  "signInRefused", // an LDAP sign-in the directory or Qeet ID refused (often a mistyped password)
  "exists", // SCIM 409: a person or group that already exists
  "notFound", // SCIM 404: a person or group Qeet ID doesn't have
  "refusedData", // SCIM 400/422: data Qeet ID can't use (a mapping refused it, no email)
  "tooMany", // 429: sent faster than Qeet ID accepts
  "denied", // SCIM 401/403: the request wasn't allowed
  "failedHere", // SCIM 5xx: it failed on Qeet ID's side
] as const;
export type Cause = (typeof CAUSES)[number];

const isScim = (connectionId: string) => connectionId.startsWith("scim:");

export function causeOf(
  event: Pick<DirectoryEvent, "connection_id" | "operation" | "http_status">,
): Cause {
  if (!isScim(event.connection_id)) {
    if (event.operation === "test") return "unreachable";
    if (event.operation === "sign-in") return "signInRefused";
  }
  const status = event.http_status;
  if (status === 409) return "exists";
  if (status === 404) return "notFound";
  if (status === 429) return "tooMany";
  if (status === 401 || status === 403) return "denied";
  if (status >= 500) return "failedHere";
  return "refusedData";
}

/** Open failures with one cause on one connection: one problem to fix, newest failure first. */
export type Problem = {
  key: string;
  connectionId: string;
  cause: Cause;
  events: DirectoryEvent[];
  critical: boolean;
  /** The failures the server can retry: open, failed LDAP connection checks. */
  retryable: DirectoryEvent[];
};

const newestFirst = (a: DirectoryEvent, b: DirectoryEvent) =>
  Date.parse(b.started_at) - Date.parse(a.started_at);

/** The open failures as problems: critical first, then the most recent. */
export function problemsOf(open: readonly DirectoryEvent[]): Problem[] {
  const byKey = new Map<string, Problem>();
  for (const event of [...open].sort(newestFirst)) {
    if (event.resolution !== "open") continue;
    const cause = causeOf(event);
    const key = `${event.connection_id}|${cause}`;
    let problem = byKey.get(key);
    if (!problem) {
      problem = {
        key,
        connectionId: event.connection_id,
        cause,
        events: [],
        critical: false,
        retryable: [],
      };
      byKey.set(key, problem);
    }
    problem.events.push(event);
    if (event.severity === "critical") problem.critical = true;
    if (event.retryable) problem.retryable.push(event);
  }
  return [...byKey.values()].sort(
    (a, b) =>
      Number(b.critical) - Number(a.critical) ||
      Date.parse(b.events[0]?.started_at ?? "") - Date.parse(a.events[0]?.started_at ?? ""),
  );
}

/** Who failures reached: people the server names, people it doesn't (a new one), and groups. */
export function reach(events: readonly DirectoryEvent[]) {
  const people = new Set<string>();
  let unnamed = 0;
  const groups = new Set<string>();
  for (const e of events) {
    if (e.resource_type === "user") {
      if (e.resource_id) people.add(e.resource_id);
      else unnamed++;
    }
    if (e.resource_type === "group") groups.add(e.resource_id || e.id);
  }
  return { people: people.size, unnamed, groups: groups.size };
}

/** Counts by cause, most first, for the band. */
export function causeCounts(open: readonly DirectoryEvent[]): [Cause, number][] {
  const counts = new Map<Cause, number>();
  for (const e of open) counts.set(causeOf(e), (counts.get(causeOf(e)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** Counts by connection, most first, for the band. */
export function connectionCounts(events: readonly DirectoryEvent[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.connection_id, (counts.get(e.connection_id) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** A run's name: "Person added", "Connection check", "Sign-in". */
export type RunKey =
  | "activity.run.test"
  | "activity.run.signIn"
  | `activity.run.${"user" | "group"}.${"post" | "put" | "patch" | "delete"}`
  | "activity.run.other";

const SCIM_OPERATIONS = ["post", "put", "patch", "delete"] as const;

export function runKey(event: Pick<DirectoryEvent, "operation" | "resource_type">): RunKey {
  if (event.operation === "test") return "activity.run.test";
  if (event.operation === "sign-in") return "activity.run.signIn";
  const operation = SCIM_OPERATIONS.find((op) => op === event.operation);
  if (operation && (event.resource_type === "user" || event.resource_type === "group"))
    return `activity.run.${event.resource_type}.${operation}`;
  return "activity.run.other";
}

/** A connection's name as the lists show it; a connection deleted since has none. */
export function connectionName(
  connections: readonly DirectoryConnection[],
  id: string,
  names: { scim: string; removed: string },
): string {
  const found = connections.find((c) => c.id === id);
  if (!found) return names.removed;
  return found.type === "scim" ? names.scim : found.name;
}

/** The port a server address names (636 for ldaps://, 389 for ldap://), for the fix's steps. */
export function portOf(serverUrl: string | null): string {
  if (!serverUrl) return "";
  try {
    const url = new URL(serverUrl);
    return url.port || (url.protocol === "ldaps:" ? "636" : "389");
  } catch {
    return "";
  }
}
