// User 360 data layer — React Query hooks over the per-user admin read surfaces
// added to the server (GET /v1/users/{id}/security | /sessions | /access), plus
// the existing effective-permissions, social-identities and activity endpoints.
// Follows the house pattern: useQuery/useMutation + api() + graceful degradation.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

// ── Types (mirror the Go response structs in internal/identity/users) ──────────

/** Full user record as returned by GET /v1/users/{id}. */
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

export interface UserSession {
  id: string;
  ip?: string | null;
  user_agent?: string | null;
  created_at: string;
  last_seen_at: string;
}

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
  /** Distinct permissions from directly-assigned roles. */
  permissions_direct: number;
  /** Permissions gained only through group membership (= total − direct). */
  permissions_inherited: number;
  /** Distinct effective permissions (direct ∪ inherited). */
  permissions_total: number;
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

export const USER360_KEYS = {
  security: (id: string) => ["user360", "security", id] as const,
  sessions: (id: string) => ["user360", "sessions", id] as const,
  access: (id: string) => ["user360", "access", id] as const,
  permissions: (id: string, tenantId: string | null) =>
    ["user360", "permissions", id, tenantId] as const,
  identities: (id: string) => ["user360", "identities", id] as const,
  recentActivity: (id: string) => ["user360", "recent-activity", id] as const,
};

// ── Reads ──────────────────────────────────────────────────────────────────────

/** Authentication posture — the six "Security posture" tiles. */
export function useUserSecurity(userId: string, enabled = true) {
  return useQuery({
    queryKey: USER360_KEYS.security(userId),
    queryFn: () => api<SecuritySummary>(`/v1/users/${userId}/security`),
    enabled: enabled && !!userId,
    staleTime: 30_000,
  });
}

/** Live sessions for the user (admin view). */
export function useUserSessions(userId: string, enabled = true) {
  return useQuery({
    queryKey: USER360_KEYS.sessions(userId),
    queryFn: () => api<{ items: UserSession[] }>(`/v1/users/${userId}/sessions`),
    enabled: enabled && !!userId,
    staleTime: 15_000,
  });
}

/** Access summary — organization, roles, groups, applications, policies. */
export function useUserAccess(userId: string, enabled = true) {
  return useQuery({
    queryKey: USER360_KEYS.access(userId),
    queryFn: () => api<AccessSummary>(`/v1/users/${userId}/access`),
    enabled: enabled && !!userId,
    staleTime: 30_000,
  });
}

/**
 * Effective permission strings for the user in the current tenant. The server
 * returns `{ permissions: string[] }` (folds in group-inherited roles). Degrades
 * to an empty list when the caller lacks role.read (403).
 */
export function useUserPermissions(userId: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: USER360_KEYS.permissions(userId, tenantId),
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

/** Linked social / OIDC identities (Google, Microsoft, GitHub, …). */
export function useUserSocialIdentities(userId: string) {
  return useQuery({
    queryKey: USER360_KEYS.identities(userId),
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
 * Recent lifecycle events for the Overview "Recent activity" card. Sourced from
 * GET /v1/activity?subject={id}; degrades to empty on 404/503 like the timeline.
 */
export function useUserRecentActivity(userId: string, limit = 6, enabled = true) {
  return useQuery({
    queryKey: [...USER360_KEYS.recentActivity(userId), limit],
    queryFn: async (): Promise<{ events: RecentActivityEvent[] }> => {
      try {
        return await api<{ events: RecentActivityEvent[] }>("/v1/activity", {
          query: { subject: userId, limit },
        });
      } catch (err) {
        const status = err instanceof ApiError ? err.status : undefined;
        if (!status || status === 404 || status === 503) return { events: [] };
        throw err;
      }
    },
    enabled: enabled && !!userId,
    staleTime: 15_000,
  });
}

/** Minimal projection of an activity event used by the Overview card. */
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

// ── Mutations ───────────────────────────────────────────────────────────────────

/** Force sign-out: revoke every live session for the user (user.write). */
export function useRevokeAllUserSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<{ revoked: number }>(`/v1/users/${userId}/sessions/revoke-all`, { method: "POST" }),
    onSuccess: (_res, userId) => {
      qc.invalidateQueries({ queryKey: USER360_KEYS.sessions(userId) });
      qc.invalidateQueries({ queryKey: USER360_KEYS.security(userId) });
    },
    meta: { successMessage: "All sessions revoked" },
  });
}

/** Toggle the per-user MFA-required policy flag (user.write). */
export function useSetMfaRequired() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, required }: { userId: string; required: boolean }) =>
      api<{ mfa_required: boolean }>(`/v1/users/${userId}/mfa-required`, {
        method: "PUT",
        body: { required },
      }),
    onSuccess: (_res, { userId }) => {
      qc.invalidateQueries({ queryKey: USER360_KEYS.security(userId) });
    },
    meta: { successMessage: "MFA requirement updated" },
  });
}

/**
 * Send the user a password-reset email by triggering the public recovery flow
 * with their address. The endpoint always 200s (no user enumeration).
 */
export function useSendPasswordReset() {
  return useMutation({
    mutationFn: (email: string) =>
      api<void>("/v1/auth/forgot-password", {
        method: "POST",
        body: { email },
        anonymous: true,
      }),
    meta: { successMessage: "Password-reset email sent" },
  });
}
