// Reads and changes only the person's page makes: their sign-in history and activity, why they're
// suspended, and taking a role, a group or this organisation away. Kept out of users.ts, which the
// shell carries through the barrel.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import { ApiError } from "@/platform/api/client";
import { useOrganizationId } from "@/platform/auth/session";
import type { SuspendedDirectoryUser } from "./suspended";
import { userKeys } from "./keys";

/** The activity endpoint is optional: absent or down, the page shows no events, not an error. */
async function activityPage(query: Record<string, string | number | undefined>) {
  try {
    return await backend.get("/v1/activity", { query });
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
    queryKey: [...userKeys.view(useOrganizationId(), userId, "activity"), "sign-ins"],
    queryFn: () =>
      activityPage({ subject: userId, types: "auth.login_succeeded", limit: SIGN_IN_SAMPLE }),
    enabled: enabled && !!userId,
    staleTime: 30_000,
    meta: { silent: true },
  });
}

/**
 * Why and since when the person is suspended: their row in the suspended list, found by their ID
 * (the list's search matches IDs too); the user record carries neither. Null when they aren't in it.
 */
export function useSuspension(userId: string, enabled: boolean) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: [...userKeys.suspended(organizationId), "person", userId],
    queryFn: async (): Promise<SuspendedDirectoryUser | null> => {
      const page = await backend.get("/v1/users/suspended", { query: { q: userId, limit: 25 } });
      const found = page.items?.find((item) => item.id === userId);
      return (found as SuspendedDirectoryUser | undefined) ?? null;
    },
    enabled: enabled && !!organizationId && !!userId,
    staleTime: 30_000,
    meta: { silent: true },
  });
}

/** Takes a role given to the person directly away from them, in this organisation. */
export function useUnassignRole() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      backend.delete("/v1/users/{userID}/organizations/{organizationID}/roles/{roleID}", {
        path: { userID: userId, organizationID: organizationId ?? "", roleID: roleId },
      }),
    onSuccess: (_, { userId }) => {
      void qc.invalidateQueries({ queryKey: userKeys.user(organizationId, userId) });
      void qc.invalidateQueries({ queryKey: userKeys.lists(organizationId) });
    },
    meta: { successMessage: "users:person.toast.roleRemoved" },
  });
}

/**
 * Removes a person whose account another organisation manages from this one: their roles, groups,
 * sessions, app sign-ins and API keys here. Their account stays with its own organisation.
 */
export function useRemoveMembership() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      backend.delete("/v1/users/{id}/membership", { path: { id: userId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: userKeys.organization(organizationId) });
    },
    meta: { successMessage: "users:person.toast.removed" },
  });
}
