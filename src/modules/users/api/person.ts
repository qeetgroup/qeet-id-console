// Reads and changes only the person's page makes: their sign-in history and activity, why they're
// suspended, and taking a role, a group or this organisation away. Kept out of users.ts, which the
// shell carries through the barrel.

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ActivityEvent } from "@/modules/activity";
import { ApiError, api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import type { SuspendedDirectoryUser } from "./suspended";
import { userKeys } from "./keys";

type ActivityPage = { events: ActivityEvent[]; next_cursor?: string };

/** The activity endpoint is optional: absent or down, the page shows no events, not an error. */
async function activityPage(query: Record<string, string | number | undefined>) {
  try {
    return await api<ActivityPage>("/v1/activity", { query });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 503)) {
      return { events: [], next_cursor: undefined };
    }
    throw err;
  }
}

/** How many of the person's latest sign-ins the page reads to say how they sign in. */
export const SIGN_IN_SAMPLE = 50;

/** The person's latest sign-ins (`auth.login_succeeded`), newest first; each names its method. */
export function useSignInHistory(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...userKeys.view(useTenantId(), userId, "activity"), "sign-ins"],
    queryFn: () =>
      activityPage({ subject: userId, types: "auth.login_succeeded", limit: SIGN_IN_SAMPLE }),
    enabled: enabled && !!userId,
    staleTime: 30_000,
    meta: { silent: true },
  });
}

/** What the Activity tab narrows the person's events to. */
export interface PersonActivityFilters {
  since: "" | "24h" | "7d" | "30d";
  category: string;
  failed: boolean;
}

export const NO_ACTIVITY_FILTERS: PersonActivityFilters = {
  since: "",
  category: "",
  failed: false,
};

const SINCE_MS = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000 } as const;

/** Events about the person (as actor or target), newest first, a page of 50 at a time. */
export function usePersonActivity(
  userId: string,
  filters: PersonActivityFilters,
  enabled: boolean,
) {
  const tenantId = useTenantId();
  return useInfiniteQuery({
    queryKey: [...userKeys.view(tenantId, userId, "activity"), filters],
    queryFn: ({ pageParam }: { pageParam: string }) =>
      activityPage({
        subject: userId,
        limit: 50,
        cursor: pageParam || undefined,
        category: filters.category || undefined,
        // The server's severity is a floor: errors and critical events are the failures.
        severity: filters.failed ? "error" : undefined,
        from: filters.since
          ? new Date(Date.now() - SINCE_MS[filters.since]).toISOString()
          : undefined,
      }),
    initialPageParam: "",
    getNextPageParam: (page) => page.next_cursor || undefined,
    enabled: enabled && !!userId,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
    meta: { silent: true },
  });
}

/**
 * Why and since when the person is suspended: their row in the suspended list, found by their ID
 * (the list's search matches IDs too); the user record carries neither. Null when they aren't in it.
 */
export function useSuspension(userId: string, enabled: boolean) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...userKeys.suspended(tenantId), "person", userId],
    queryFn: async (): Promise<SuspendedDirectoryUser | null> => {
      const page = await api<{ items: SuspendedDirectoryUser[] }>("/v1/users/suspended", {
        query: { q: userId, limit: 25 },
      });
      return page.items.find((item) => item.id === userId) ?? null;
    },
    enabled: enabled && !!tenantId && !!userId,
    staleTime: 30_000,
    meta: { silent: true },
  });
}

/** Takes a role given to the person directly away from them, in this organisation. */
export function useUnassignRole() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      api<void>(`/v1/users/${userId}/tenants/${tenantId}/roles/${roleId}`, { method: "DELETE" }),
    onSuccess: (_, { userId }) => {
      void qc.invalidateQueries({ queryKey: userKeys.user(tenantId, userId) });
      void qc.invalidateQueries({ queryKey: userKeys.lists(tenantId) });
    },
    meta: { successMessage: "users:person.toast.roleRemoved" },
  });
}

/**
 * Removes a person whose account another organisation manages from this one: their roles, groups,
 * sessions, app sign-ins and API keys here. Their account stays with its own organisation.
 */
export function useRemoveMembership() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<{ roles_removed: number; sessions_ended: number }>(`/v1/users/${userId}/membership`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: userKeys.tenant(tenantId) });
    },
    meta: { successMessage: "users:person.toast.removed" },
  });
}
