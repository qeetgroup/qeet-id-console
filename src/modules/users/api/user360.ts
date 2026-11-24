import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ActivityEvent } from "@/modules/activity";
import { backend } from "@/platform/api/backend";
import { ApiError } from "@/platform/api/client";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";

import { userKeys } from "./keys";

/** The full user record from GET /v1/users/{id}. */
export type UserDetail = Answer<"/v1/users/{id}">;
/** How the person signs in: factors, passkeys, recovery codes, password and sessions. */
export type SecuritySummary = Answer<"/v1/users/{id}/security">;
export type UserSession = Answer<"/v1/users/{id}/sessions">["items"][number];
/** What the person can reach: their organisation, roles, groups and the counts beneath. */
export type AccessSummary = Answer<"/v1/users/{id}/access">;
export type RoleInfo = AccessSummary["roles"][number];
export type GroupInfo = AccessSummary["groups"][number];
export type SocialIdentity = Answer<"/v1/users/{userID}/social/identities">["items"][number];

export function useUserSecurity(userId: string, enabled = true) {
  return useQuery({
    queryKey: userKeys.view(useOrganizationId(), userId, "security"),
    queryFn: () => backend.get("/v1/users/{id}/security", { path: { id: userId } }),
    enabled: enabled && !!userId,
    staleTime: 30_000,
  });
}

export function useUserSessions(userId: string, enabled = true) {
  return useQuery({
    queryKey: userKeys.view(useOrganizationId(), userId, "sessions"),
    queryFn: () => backend.get("/v1/users/{id}/sessions", { path: { id: userId } }),
    enabled: enabled && !!userId,
    staleTime: 15_000,
  });
}

export function useUserAccess(userId: string, enabled = true) {
  return useQuery({
    queryKey: userKeys.view(useOrganizationId(), userId, "access"),
    queryFn: () => backend.get("/v1/users/{id}/access", { path: { id: userId } }),
    enabled: enabled && !!userId,
    staleTime: 30_000,
  });
}

/**
 * Fetches the user's effective permissions in the current tenant, including those inherited
 * through groups. A 403 (no role.read) or 404 yields an empty list rather than an error.
 */
export function useUserPermissions(userId: string) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: userKeys.view(organizationId, userId, "permissions"),
    queryFn: async (): Promise<{ permissions: string[] }> => {
      try {
        const answer = await backend.get(
          "/v1/users/{userID}/organizations/{organizationID}/permissions",
          { path: { userID: userId, organizationID: organizationId ?? "" } },
        );
        return { permissions: answer.permissions ?? [] };
      } catch (err) {
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          return { permissions: [] };
        }
        throw err;
      }
    },
    enabled: !!organizationId && !!userId,
    staleTime: 30_000,
  });
}

/** Fetches the user's linked social identities; a 403 or 404 yields an empty list. */
export function useUserSocialIdentities(userId: string) {
  return useQuery({
    queryKey: userKeys.view(useOrganizationId(), userId, "identities"),
    queryFn: async (): Promise<{ items: SocialIdentity[] }> => {
      try {
        return await backend.get("/v1/users/{userID}/social/identities", {
          path: { userID: userId },
        });
      } catch (err) {
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          return { items: [] };
        }
        throw err;
      }
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/**
 * Fetches the user's most recent activity events. A 404 or 503, where the activity service is
 * absent or down, yields an empty list.
 */
export function useUserRecentActivity(userId: string, limit = 6, enabled = true) {
  return useQuery({
    queryKey: [...userKeys.view(useOrganizationId(), userId, "recent-activity"), limit],
    queryFn: async (): Promise<{ events: ActivityEvent[] }> => {
      try {
        return await backend.get("/v1/activity", { query: { subject: userId, limit } });
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 503)) {
          return { events: [] };
        }
        throw err;
      }
    },
    enabled: enabled && !!userId,
    staleTime: 15_000,
  });
}

/** Signs the user out everywhere by revoking all their live sessions; needs user.write. */
export function useRevokeAllUserSessions() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      backend.post("/v1/users/{id}/sessions/revoke-all", { path: { id: userId } }),
    // It also forgets their remembered devices and ends their app sign-ins: every view of them.
    onSuccess: (_res, userId) =>
      void qc.invalidateQueries({ queryKey: userKeys.user(organizationId, userId) }),
    meta: { successMessage: "users:toast.allSessionsRevoked" },
  });
}

/** Sets whether this user must use MFA; needs user.write. */
export function useSetMfaRequired() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, required }: { userId: string; required: boolean }) =>
      backend.put("/v1/users/{id}/mfa-required", { path: { id: userId }, body: { required } }),
    onSuccess: (_res, { userId }) => {
      void qc.invalidateQueries({ queryKey: userKeys.view(organizationId, userId, "security") });
    },
    meta: { successMessage: "users:toast.mfaRequirementUpdated" },
  });
}

/**
 * Sends a password-reset email through the public recovery flow. The endpoint always answers
 * 200, so it can't reveal whether an account exists.
 */
export function useSendPasswordReset() {
  return useMutation({
    mutationFn: (email: string) =>
      backend.post("/v1/auth/forgot-password", { body: { email }, anonymous: true }),
    meta: { successMessage: "users:toast.passwordResetEmailSent" },
  });
}
