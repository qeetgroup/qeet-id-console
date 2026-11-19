import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import type { ActivityEvent } from "@/modules/activity";
import { assured, strictly } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import { ApiError } from "@/platform/api/client";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";

import { userKeys } from "./keys";

// The user record and its views: the document leaves their fields optional, the server always
// sends them (user.go, user360.go), so each view is held to the fields its page reads.
export const userRecord = assured<Answer<"/v1/users/{id}">>()(
  "id",
  "email",
  "status",
  "created_at",
  "updated_at",
);
const securitySummary = assured<Answer<"/v1/users/{id}/security">>()(
  "mfa_required",
  "mfa_enabled",
  "totp_enabled",
  "otp_factors",
  "push_devices",
  "passkeys",
  "recovery_codes_remaining",
  "password_set",
  "active_sessions",
  "distinct_devices",
);
const named = z.object({ id: z.string(), name: z.string(), description: z.string() });
const accessSummary = strictly<Answer<"/v1/users/{id}/access">>()(
  z.object({
    organization: z.object({ id: z.string(), name: z.string(), slug: z.string() }).optional(),
    roles: z.array(named),
    groups: z.array(named),
    applications_count: z.number(),
    policies_count: z.number(),
    permissions_direct: z.number(), // distinct, from directly assigned roles
    permissions_inherited: z.number(), // only through group membership: total − direct
    permissions_total: z.number(), // distinct effective permissions: direct ∪ inherited
  }),
);
const userSessions = strictly<Answer<"/v1/users/{id}/sessions">>()(
  z.object({
    items: z.array(
      z.object({
        id: z.string(),
        ip: z.string().nullable(),
        user_agent: z.string().nullable(),
        created_at: z.string(),
        last_seen_at: z.string(),
      }),
    ),
  }),
);

/** The full user record from GET /v1/users/{id}. */
export type UserDetail = z.output<typeof userRecord>;
/** How the person signs in: factors, passkeys, recovery codes, password and sessions. */
export type SecuritySummary = z.output<typeof securitySummary>;
export type UserSession = z.output<typeof userSessions>["items"][number];
/** What the person can reach: their organisation, roles, groups and the counts beneath. */
export type AccessSummary = z.output<typeof accessSummary>;
export type RoleInfo = AccessSummary["roles"][number];
export type GroupInfo = AccessSummary["groups"][number];
export type SocialIdentity = Answer<"/v1/users/{userID}/social/identities">["items"][number];

export function useUserSecurity(userId: string, enabled = true) {
  return useQuery({
    queryKey: userKeys.view(useOrganizationId(), userId, "security"),
    queryFn: () =>
      backend.get("/v1/users/{id}/security", { path: { id: userId }, schema: securitySummary }),
    enabled: enabled && !!userId,
    staleTime: 30_000,
  });
}

export function useUserSessions(userId: string, enabled = true) {
  return useQuery({
    queryKey: userKeys.view(useOrganizationId(), userId, "sessions"),
    queryFn: () =>
      backend.get("/v1/users/{id}/sessions", { path: { id: userId }, schema: userSessions }),
    enabled: enabled && !!userId,
    staleTime: 15_000,
  });
}

export function useUserAccess(userId: string, enabled = true) {
  return useQuery({
    queryKey: userKeys.view(useOrganizationId(), userId, "access"),
    queryFn: () =>
      backend.get("/v1/users/{id}/access", { path: { id: userId }, schema: accessSummary }),
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
