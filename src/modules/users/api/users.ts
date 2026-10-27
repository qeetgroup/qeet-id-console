import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import type { ImportRowError } from "../import-errors";
import type { ImportRow } from "../import-file";
import { type UserListParams, userKeys } from "./keys";
import type { UserDetail } from "./user360";

export type UserStatus = "active" | "invited" | "suspended" | "deleted";

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  status: UserStatus;
  email_verified_at?: string | null;
  phone_verified_at?: string | null;
  roles?: string[] | null;
  /** What the organisation records about them: department, title, location and the like. */
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
  mfa_enabled?: boolean; // Only the list endpoint fills these; a single-user read omits them
  groups_count?: number;
  last_seen_at?: string | null;
  last_seen_ip?: string | null;
}

export type UserPage = { items: User[]; next_cursor?: string };

/** The most people the Users list loads, 200 at a time, to filter, count and sort itself. */
export const DIRECTORY_CAP = 2000;
const DIRECTORY_PAGE = 200;

/** Everyone in the organisation, up to DIRECTORY_CAP; `complete` is false when there are more. */
export type UserDirectory = { items: User[]; complete: boolean };

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

/** A soft-deleted user, restorable until purged. */
export interface DeletedUser {
  id: string;
  email: string;
  display_name: string | null;
  deleted_at: string;
  /** Who deleted them, when the server knows. */
  deleted_by?: string | null;
  created_at: string;
}

/** Query definitions for the users reads, shared by hooks, prefetches and cache reads. */
export const userQueries = {
  list: (tenantId: string | null, params: UserListParams) =>
    queryOptions({
      queryKey: userKeys.list(tenantId, params),
      queryFn: () => api<UserPage>("/v1/users", { query: params }),
      enabled: !!tenantId,
    }),
  // The list API has no filters or counts of its own yet, so the Users list walks it with the
  // cursor and works over everyone it got.
  directory: (tenantId: string | null) =>
    queryOptions({
      queryKey: userKeys.directory(tenantId),
      queryFn: async ({ signal }): Promise<UserDirectory> => {
        const items: User[] = [];
        let cursor: string | undefined;
        do {
          const page: UserPage = await api<UserPage>("/v1/users", {
            query: { limit: DIRECTORY_PAGE, cursor },
            signal,
          });
          items.push(...page.items);
          cursor = page.next_cursor || undefined;
        } while (cursor && items.length < DIRECTORY_CAP);
        return { items, complete: !cursor };
      },
      enabled: !!tenantId,
      staleTime: 30_000,
    }),
  detail: (tenantId: string | null, userId: string) =>
    queryOptions({
      queryKey: userKeys.detail(tenantId, userId),
      queryFn: () => api<UserDetail>(`/v1/users/${userId}`),
      enabled: !!tenantId && !!userId,
    }),
  stats: (tenantId: string | null) =>
    queryOptions({
      queryKey: userKeys.stats(tenantId),
      queryFn: () => api<UserStats>("/v1/users/stats"),
      enabled: !!tenantId,
      staleTime: 30_000,
    }),
  trends: (tenantId: string | null) =>
    queryOptions({
      queryKey: userKeys.trends(tenantId),
      queryFn: () => api<UserTrends>("/v1/users/trends"),
      enabled: !!tenantId,
      staleTime: 60_000,
    }),
  deleted: (tenantId: string | null) =>
    queryOptions({
      queryKey: userKeys.deleted(tenantId),
      queryFn: () => api<{ items: DeletedUser[] }>("/v1/users/deleted"),
      enabled: !!tenantId,
    }),
};

/** Refreshes what a change to who's in the tenant can move: the lists and the counts. */
function refreshMembership(qc: QueryClient, tenantId: string | null) {
  void qc.invalidateQueries({ queryKey: userKeys.lists(tenantId) });
  void qc.invalidateQueries({ queryKey: userKeys.stats(tenantId) });
  void qc.invalidateQueries({ queryKey: userKeys.trends(tenantId) });
}

/** Refreshes the membership views and every view of one user. */
function refreshUser(qc: QueryClient, tenantId: string | null, userId: string) {
  refreshMembership(qc, tenantId);
  void qc.invalidateQueries({ queryKey: userKeys.user(tenantId, userId) });
}

export function useUserDirectory() {
  return useQuery(userQueries.directory(useTenantId()));
}

export function useUser(userId: string) {
  return useQuery(userQueries.detail(useTenantId(), userId));
}

export function useUserStats(enabled = true) {
  const options = userQueries.stats(useTenantId());
  return useQuery({ ...options, enabled: options.enabled && enabled });
}

export function useUserTrends() {
  return useQuery(userQueries.trends(useTenantId()));
}

export function useDeletedUsers() {
  return useQuery(userQueries.deleted(useTenantId()));
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

/**
 * Creates a user, then assigns `role_id` when given. If the assignment fails the mutation
 * rejects, but the user still exists.
 */
export function useCreateUser() {
  const tenantId = useTenantId();
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
          refreshMembership(qc, tenantId);
          throw err;
        }
      }
      return user;
    },
    onSuccess: () => refreshMembership(qc, tenantId),
    meta: { successMessage: "users:toast.created" },
  });
}

export function useUpdateUser() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: UpdateUserBody }) =>
      api<User>(`/v1/users/${userId}`, { method: "PATCH", body }),
    onSuccess: (_, { userId }) => refreshUser(qc, tenantId, userId),
    meta: { successMessage: "users:toast.updated" },
  });
}

export function useSetUserStatus() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: "active" | "suspended" }) =>
      api<User>(`/v1/users/${userId}`, { method: "PATCH", body: { status } }),
    onSuccess: (_, { userId }) => {
      refreshUser(qc, tenantId, userId);
      void qc.invalidateQueries({ queryKey: userKeys.suspended(tenantId) });
    },
    meta: { successMessage: "users:toast.userStatusUpdated" },
  });
}

/** Soft-deletes a user; it stays restorable until purged. */
export function useDeleteUser() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api<void>(`/v1/users/${userId}`, { method: "DELETE" }),
    onSuccess: (_, userId) => {
      refreshUser(qc, tenantId, userId);
      void qc.invalidateQueries({ queryKey: userKeys.deleted(tenantId) });
    },
    meta: { successMessage: "users:toast.deleted" },
  });
}

/** Restores a soft-deleted user. */
export function useRestoreUser() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api<void>(`/v1/users/${userId}/restore`, { method: "POST" }),
    onSuccess: () => {
      refreshMembership(qc, tenantId);
      void qc.invalidateQueries({ queryKey: userKeys.deleted(tenantId) });
    },
    meta: { successMessage: "users:toast.userRestored" },
  });
}

/** Erases a soft-deleted user for good. */
export function usePurgeUser() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api<void>(`/v1/users/${userId}/purge`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: userKeys.deleted(tenantId) }),
    meta: { successMessage: "users:toast.userPermanentlyDeleted" },
  });
}

/**
 * Clears every MFA factor the user enrolled, so they enroll again at next sign-in. The server
 * requires user.write and audits the reset.
 */
export function useResetUserMfa() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<{ message: string }>(`/v1/users/${userId}/mfa`, { method: "DELETE" }),
    onSuccess: (_, userId) => refreshUser(qc, tenantId, userId),
    meta: { successMessage: "users:toast.mfaReset" },
  });
}

/** Sets a user's password; the person isn't told it changed. */
export function useSetUserPassword() {
  return useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      api<void>(`/v1/users/${userId}/password`, { method: "POST", body: { password } }),
    meta: { successMessage: "users:toast.passwordUpdated" },
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
    onSuccess: (_, { userId }) => refreshUser(qc, tenantId, userId),
    meta: { successMessage: "users:toast.roleAssigned" },
  });
}

/** The per-row outcome of a bulk import. */
export interface BulkImportResult {
  succeeded: number;
  failed: number;
  errors?: ImportRowError[];
}

/** Creates the rows' users in one request; each row succeeds or fails on its own. */
export function useBulkImportUsers() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: ImportRow[]): Promise<BulkImportResult> => {
      const res = await api<BulkImportResult>("/v1/users/bulk", {
        method: "POST",
        body: {
          tenant_id: tenantId,
          users: rows.map(({ email, password, display_name, phone }) => ({
            email,
            password,
            display_name,
            phone,
          })),
        },
      });
      // The backend numbers rows by their place in the batch; name the file's line instead.
      const errors = res.errors?.map(({ line, email, code, field }) => ({
        line: line ? rows[line - 1]?.line : undefined,
        email,
        code,
        field,
      }));
      return { ...res, errors };
    },
    onSuccess: () => refreshMembership(qc, tenantId),
    meta: { silent: true }, // the page shows the outcome, and any error, itself
  });
}

/**
 * The per-user calls a bulk action makes for each selected user; there is no batch endpoint.
 * The caller refreshes the users views once the batch is done.
 */
export const perUserCalls = {
  assignRole: (tenantId: string, roleId: string) => (userId: string) =>
    api<void>(`/v1/users/${userId}/tenants/${tenantId}/roles/${roleId}`, { method: "POST" }),
  addToGroup: (groupId: string) => (userId: string) =>
    api<void>(`/v1/groups/${groupId}/members/${userId}`, { method: "POST" }),
  requireMfa: (userId: string) =>
    api<void>(`/v1/users/${userId}/mfa-required`, { method: "PUT", body: { required: true } }),
  revokeSessions: (userId: string) =>
    api<void>(`/v1/users/${userId}/sessions/revoke-all`, { method: "POST" }),
  suspend: (userId: string) =>
    api<void>(`/v1/users/${userId}`, { method: "PATCH", body: { status: "suspended" } }),
  remove: (userId: string) => api<void>(`/v1/users/${userId}`, { method: "DELETE" }),
  restore: (userId: string) => api<void>(`/v1/users/${userId}/restore`, { method: "POST" }),
  purge: (userId: string) => api<void>(`/v1/users/${userId}/purge`, { method: "DELETE" }),
};
