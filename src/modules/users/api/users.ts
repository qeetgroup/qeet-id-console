import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import { USER360_KEYS } from "./user360";

export type UserStatus = "active" | "invited" | "suspended" | "deleted";

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  display_name?: string | null;
  phone?: string | null;
  status: UserStatus;
  email_verified_at?: string | null;
  phone_verified_at?: string | null;
  roles?: string[] | null;
  created_at: string;
  updated_at?: string;
  mfa_enabled?: boolean; // Only the list endpoint fills these; a single-user read omits them
  groups_count?: number;
  last_seen_at?: string | null;
  last_seen_ip?: string | null;
}

/** Tenant-wide member counts. */
export interface UserStats {
  total: number;
  active: number;
  suspended: number;
  invited: number;
  mfa_enabled: number;
  mfa_missing: number;
  new_last_30d: number;
}

/** Daily counts over the last 30 days, oldest first. */
export interface UserTrends {
  total: number[];
  mfa_enabled: number[];
}

export function useUserStats(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["user-stats", tenantId],
    queryFn: () => api<UserStats>("/v1/users/stats"),
    enabled: !!tenantId && enabled,
    staleTime: 30_000,
  });
}

export function useUserTrends() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["user-trends", tenantId],
    queryFn: () => api<UserTrends>("/v1/users/trends"),
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export interface CreateUserInput {
  email: string;
  tenant_id: string;
  password?: string;
  display_name?: string;
  phone?: string;
  role_id?: string; // assigned straight after the user is created
}

export interface UpdateUserBody {
  display_name?: string | null;
  phone?: string | null;
  status?: "active" | "suspended";
}

export const USER_KEYS = {
  all: ["users"] as const,
  detail: (id: string) => ["user", id] as const,
  activity: (id: string, tenantId: string | null) => ["user-activity", id, tenantId] as const,
};

/**
 * Creates a user, then assigns `role_id` when given. If the assignment fails the mutation
 * rejects, but the user still exists.
 */
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const { role_id, ...body } = input;
      const user = await api<User>("/v1/users", { method: "POST", body });
      if (role_id) {
        try {
          await api<void>(`/v1/users/${user.id}/tenants/${body.tenant_id}/roles/${role_id}`, {
            method: "POST",
          });
        } catch (err) {
          // The user exists even though the role didn't stick, so the list must show it.
          qc.invalidateQueries({ queryKey: USER_KEYS.all });
          throw err;
        }
      }
      return user;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USER_KEYS.all }),
    meta: { successMessage: "User created" },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: UpdateUserBody }) =>
      api<User>(`/v1/users/${userId}`, { method: "PATCH", body }),
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: USER_KEYS.all });
      qc.invalidateQueries({ queryKey: USER_KEYS.detail(userId) });
    },
    meta: { successMessage: "User updated" },
  });
}

export function useSetUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: "active" | "suspended" }) =>
      api<User>(`/v1/users/${userId}`, { method: "PATCH", body: { status } }),
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: USER_KEYS.all });
      qc.invalidateQueries({ queryKey: USER_KEYS.detail(userId) });
    },
    meta: { successMessage: "User status updated" },
  });
}

/** Soft-deletes a user. */
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api<void>(`/v1/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: USER_KEYS.all }),
    meta: { successMessage: "User deleted" },
  });
}

/**
 * Clears every MFA factor the user enrolled, so they enroll again at next sign-in. The server
 * requires user.write and audits the reset.
 */
export function useResetUserMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<{ message: string }>(`/v1/users/${userId}/mfa`, { method: "DELETE" }),
    onSuccess: (_, userId) => {
      // MFA state also shows in the security posture, the list and the stats.
      qc.invalidateQueries({ queryKey: USER_KEYS.detail(userId) });
      qc.invalidateQueries({ queryKey: USER360_KEYS.security(userId) });
      qc.invalidateQueries({ queryKey: USER_KEYS.all });
      qc.invalidateQueries({ queryKey: ["user-stats"] });
    },
    meta: { successMessage: "Multi-factor authentication reset for this user" },
  });
}

/** Assigns a role to a user in the current tenant. */
export function useAssignRole() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<void>(`/v1/users/${userId}/tenants/${tenantId}/roles/${roleId}`, {
        method: "POST",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USER_KEYS.all }),
    meta: { successMessage: "Role assigned" },
  });
}
