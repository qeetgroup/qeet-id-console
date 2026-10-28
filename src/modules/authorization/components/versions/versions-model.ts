// A policy's versions, from its saves in the audit log: each create or change is the next version,
// numbered per policy, and the newest is the current one unless the policy was deleted. The log
// keeps four of a policy's fields at each save (abac: name, effect, resource type, action), so only
// those can be compared between versions; there are no snapshots to restore (a QTID gap).

import type { ActivityEvent } from "@/modules/authorization/api/authz-activity";

export const VERSION_FIELDS = ["name", "effect", "resource_type", "action"] as const;
export type VersionField = (typeof VERSION_FIELDS)[number];
export const CHANGES = ["created", "changed", "deleted"] as const;
export type VersionChange = (typeof CHANGES)[number];
export const DAY_MS = 86_400_000;

/** `?q=…&policy=…&actor=…&change=…&look=week`, and `version=<event id>` for the open one. */
export type VersionFilters = {
  q?: string;
  policy?: string;
  actor?: string;
  change?: VersionChange;
  look?: "week";
};

export type PolicyVersion = {
  event: ActivityEvent;
  policyId: string;
  /** The policy's latest name in the log. */
  policy: string;
  n: number;
  /** The policy as it is now: its newest save, while it exists. */
  current: boolean;
  change: VersionChange;
  /** The save before it, to compare with. */
  previous?: ActivityEvent;
};

const changeOf = (type: string): VersionChange =>
  type.endsWith("created") ? "created" : type.endsWith("deleted") ? "deleted" : "changed";

/** Every save of every policy, newest first, numbered per policy from its first. */
export function policyVersions(
  events: readonly ActivityEvent[],
  nameOf: (policyId: string) => string | undefined,
): PolicyVersion[] {
  const byPolicy = new Map<string, ActivityEvent[]>();
  for (const e of events) {
    const id = e.target?.id;
    if (!id) continue;
    byPolicy.set(id, [...(byPolicy.get(id) ?? []), e]);
  }
  const out: PolicyVersion[] = [];
  for (const [policyId, list] of byPolicy) {
    const asc = [...list].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    const latestName = [...asc]
      .reverse()
      .map((e) => e.metadata?.name)
      .find((name): name is string => typeof name === "string" && !!name.trim());
    const policy = nameOf(policyId) ?? latestName ?? policyId.slice(0, 8);
    const last = asc[asc.length - 1];
    asc.forEach((event, i) => {
      const change = changeOf(event.type);
      out.push({
        event,
        policyId,
        policy,
        n: i + 1,
        current: event === last && change !== "deleted",
        change,
        previous: asc[i - 1],
      });
    });
  }
  return out.sort((a, b) => b.event.at.localeCompare(a.event.at));
}

export type FieldChange = { field: VersionField; before?: string; after?: string };

/** The kept fields that differ between a save and the one before it. */
export function fieldChanges(version: PolicyVersion): FieldChange[] {
  const before = version.previous?.metadata ?? {};
  const after = version.event.metadata ?? {};
  const read = (meta: Record<string, unknown>, field: VersionField) =>
    typeof meta[field] === "string" ? (meta[field] as string) : undefined;
  return VERSION_FIELDS.map((field) => ({
    field,
    before: read(before, field),
    after: read(after, field),
  })).filter((c) => c.before !== c.after);
}

/** Saves per month, oldest first, ending with this month. */
export function savesByMonth(
  versions: readonly PolicyVersion[],
  now: number,
  months = 12,
): number[] {
  const today = new Date(now);
  return Array.from({ length: months }, (_, i) => {
    const start = new Date(today.getFullYear(), today.getMonth() - (months - 1) + i, 1).getTime();
    const end = new Date(today.getFullYear(), today.getMonth() - (months - 1) + i + 1, 1).getTime();
    return versions.filter((v) => {
      const at = Date.parse(v.event.at);
      return at >= start && at < end;
    }).length;
  });
}
