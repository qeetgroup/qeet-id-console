import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { ApiError, api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import { userKeys } from "./keys";

/** The full user record from GET /v1/users/{id}. */
export interface UserDetail {
  id: string;
  tenant_id: string;
  email: string;
  email_verified_at?: string | null;
  phone?: string | null;
  phone_verified_at?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  status: "active" | "invited" | "suspended" | "deleted";
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SecuritySummary {
  mfa_required: boolean;
  mfa_enabled: boolean;
  totp_enabled: boolean;
  otp_factors: number;
  push_devices: number;
  passkeys: number;
  passkey_last_used_at?: string | null;
  recovery_codes_remaining: number;
  password_set: boolean;
  password_changed_at?: string | null;
  active_sessions: number;
  distinct_devices: number;
}

const userSessionSchema = z.object({
  id: z.string(),
  ip: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: z.string(),
  last_seen_at: z.string(),
});
export type UserSession = z.infer<typeof userSessionSchema>;

const userSessionsSchema = z.object({ items: z.array(userSessionSchema) });

export interface RoleInfo {
  id: string;
  name: string;
  description: string;
}

export interface GroupInfo {
  id: string;
  name: string;
  description: string;
}

export interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
}

export interface AccessSummary {
  organization: OrganizationInfo | null;
  roles: RoleInfo[];
  groups: GroupInfo[];
  applications_count: number;
  policies_count: number;
  permissions_direct: number; // distinct, from directly assigned roles
  permissions_inherited: number; // only through group membership: total − direct
  permissions_total: number; // distinct effective permissions: direct ∪ inherited
}

export interface SocialIdentity {
  id: string;
  user_id: string;
  tenant_id: string;
  provider: string;
  subject: string;
  email?: string | null;
  linked_at: string;
}

export function useUserSecurity(userId: string, enabled = true) {
  return useQuery({
    queryKey: userKeys.view(useTenantId(), userId, "security"),
    queryFn: () => api<SecuritySummary>(`/v1/users/${userId}/security`),
    enabled: enabled && !!userId,
    staleTime: 30_000,
  });
}

export function useUserSessions(userId: string, enabled = true) {
  return useQuery({
    queryKey: userKeys.view(useTenantId(), userId, "sessions"),
    queryFn: () => api(`/v1/users/${userId}/sessions`, { schema: userSessionsSchema }),
    enabled: enabled && !!userId,
    staleTime: 15_000,
  });
}

export function useUserAccess(userId: string, enabled = true) {
  return useQuery({
    queryKey: userKeys.view(useTenantId(), userId, "access"),
    queryFn: () => api<AccessSummary>(`/v1/users/${userId}/access`),
    enabled: enabled && !!userId,
    staleTime: 30_000,
  });
}

/**
 * Fetches the user's effective permissions in the current tenant, including those inherited
 * through groups. A 403 (no role.read) or 404 yields an empty list rather than an error.
 */
export function useUserPermissions(userId: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: userKeys.view(tenantId, userId, "permissions"),
    queryFn: async (): Promise<{ permissions: string[] }> => {
      try {
        return await api<{ permissions: string[] }>(
          `/v1/users/${userId}/tenants/${tenantId}/permissions`,
        );
      } catch (err) {
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          return { permissions: [] };
        }
        throw err;
      }
    },
    enabled: !!tenantId && !!userId,
    staleTime: 30_000,
  });
}

/** Fetches the user's linked social identities; a 403 or 404 yields an empty list. */
export function useUserSocialIdentities(userId: string) {
  return useQuery({
    queryKey: userKeys.view(useTenantId(), userId, "identities"),
    queryFn: async (): Promise<{ items: SocialIdentity[] }> => {
      try {
        return await api<{ items: SocialIdentity[] }>(`/v1/users/${userId}/social/identities`);
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
    queryKey: [...userKeys.view(useTenantId(), userId, "recent-activity"), limit],
    queryFn: async (): Promise<{ events: RecentActivityEvent[] }> => {
      try {
        return await api<{ events: RecentActivityEvent[] }>("/v1/activity", {
          query: { subject: userId, limit },
        });
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

/** The subset of an activity event's fields the user overview reads. */
export interface RecentActivityEvent {
  id: string;
  category?: string;
  severity?: "info" | "success" | "warning" | "error" | "critical";
  title: string;
  description?: string | null;
  at: string;
  ip?: string | null;
  location?: string | null;
  device?: string | null;
  browser?: string | null;
  status?: string | null;
}

/** Signs the user out everywhere by revoking all their live sessions; needs user.write. */
export function useRevokeAllUserSessions() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<{ revoked: number }>(`/v1/users/${userId}/sessions/revoke-all`, { method: "POST" }),
    onSuccess: (_res, userId) => {
      void qc.invalidateQueries({ queryKey: userKeys.view(tenantId, userId, "sessions") });
      void qc.invalidateQueries({ queryKey: userKeys.view(tenantId, userId, "security") });
    },
    meta: { successMessage: "users:toast.allSessionsRevoked" },
  });
}

/** Sets whether this user must use MFA; needs user.write. */
export function useSetMfaRequired() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, required }: { userId: string; required: boolean }) =>
      api<{ mfa_required: boolean }>(`/v1/users/${userId}/mfa-required`, {
        method: "PUT",
        body: { required },
      }),
    onSuccess: (_res, { userId }) => {
      void qc.invalidateQueries({ queryKey: userKeys.view(tenantId, userId, "security") });
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
      api<void>("/v1/auth/forgot-password", {
        method: "POST",
        body: { email },
        anonymous: true,
      }),
    meta: { successMessage: "users:toast.passwordResetEmailSent" },
  });
}
