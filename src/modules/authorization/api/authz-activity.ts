// The authorization changes in the audit log, read through the activity feed: it filters by
// several actions on the server (`types`), and returns each event's metadata, its actor's name and
// the browser. The audit list itself takes one resource type at a time and no metadata, so the old
// page read the latest 200 events and kept the authorization ones (usually none).
//
// Grants and revokes of a role's permissions aren't here: the server records them on the platform
// chain, not the organisation's (rbac Service.GrantPermission), so no tenant read returns them.

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  type ActivityEvent,
  type ActivityFilters,
  type ActivitySummary,
  DEFAULT_FILTERS,
  useActivityHistory,
} from "@/modules/activity";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authzKeys } from "./keys";

export const CHANGE_KINDS = ["policies", "roles", "groupRoles", "relationships"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

/** The audit actions of each kind of authorization change (the server's names). */
export const KIND_ACTIONS: Record<ChangeKind, readonly string[]> = {
  policies: ["abac_policy.created", "abac_policy.updated", "abac_policy.deleted"],
  roles: ["role.created", "role.assigned", "role.unassigned"],
  groupRoles: ["role.group_assigned", "role.group_unassigned"],
  relationships: ["rebac.tuple_written", "rebac.tuple_deleted"],
};
export const AUTHZ_ACTIONS = CHANGE_KINDS.flatMap((k) => KIND_ACTIONS[k]);

/** An action's catalogue key, under `lists.audit.titles`; every action above has one. */
export type ChangeTitle =
  | "abac_policy_created"
  | "abac_policy_updated"
  | "abac_policy_deleted"
  | "role_created"
  | "role_assigned"
  | "role_unassigned"
  | "role_group_assigned"
  | "role_group_unassigned"
  | "rebac_tuple_written"
  | "rebac_tuple_deleted";
export function changeTitle(action: string): ChangeTitle | null {
  return (AUTHZ_ACTIONS as readonly string[]).includes(action)
    ? (action.replace(/\./g, "_") as ChangeTitle)
    : null;
}

export function kindOf(action: string): ChangeKind | undefined {
  return CHANGE_KINDS.find((k) => KIND_ACTIONS[k].includes(action));
}

export type ChangeFilters = { kind?: ChangeKind; actor?: string; q?: string };

/** The authorization changes, newest first, a page at a time (the server's cursor). */
export function useAuthzChanges(filters: ChangeFilters, enabled = true) {
  const activity: ActivityFilters = {
    ...DEFAULT_FILTERS,
    types: [...(filters.kind ? KIND_ACTIONS[filters.kind] : AUTHZ_ACTIONS)],
    actor: filters.actor ?? "",
    q: filters.q ?? "",
  };
  const query = useActivityHistory(activity, enabled);
  const events = useMemo(
    () => query.data?.pages.flatMap((page) => page.events) ?? [],
    [query.data],
  );
  return { ...query, events };
}

const SUMMARY_DAYS = 90;
const DAY_MS = 86_400_000;

/**
 * The last 90 days of changes (the summary's longest window), in all and by kind: a total, the
 * people who made them and a day-by-day series.
 */
export function useAuthzSummary(enabled = true) {
  const tenantId = useTenantId();
  // From the start of a day, so the query stays the same all day.
  const from = new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS - SUMMARY_DAYS * DAY_MS);
  const fromIso = from.toISOString();
  const sets: (ChangeKind | "all")[] = ["all", ...CHANGE_KINDS];
  const results = useQueries({
    queries: sets.map((set) => ({
      queryKey: [...authzKeys.tenant(tenantId), "changes-summary", set, fromIso] as const,
      enabled: enabled && !!tenantId,
      staleTime: 60_000,
      meta: { silent: true },
      queryFn: () =>
        api<ActivitySummary>("/v1/activity/summary", {
          query: {
            types: (set === "all" ? AUTHZ_ACTIONS : KIND_ACTIONS[set]).join(","),
            from: fromIso,
          },
        }),
    })),
  });
  const [all, ...kinds] = results;
  return {
    all: all?.data,
    byKind: Object.fromEntries(CHANGE_KINDS.map((k, i) => [k, kinds[i]?.data?.total])) as Record<
      ChangeKind,
      number | undefined
    >,
    pending: results.some((r) => r.isPending),
    error: results.find((r) => r.error)?.error ?? null,
  };
}

export type { ActivityEvent };
