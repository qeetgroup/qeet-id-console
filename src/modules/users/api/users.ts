import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { z } from "zod";

import { assured, assuredItems } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer, Body } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";

import type { ImportRowError } from "../import-errors";
import type { ImportRow } from "../import-file";
import { type UserListParams, userKeys } from "./keys";
import { userRecord } from "./user360";

export type UserStatus = "active" | "invited" | "suspended" | "deleted";

// The members list and the counts: the document leaves their fields optional, the server always
// sends them (user.go), so each read is held to what the pages use.
const userPage = assuredItems<Answer<"/v1/users">>()("id", "email", "status", "created_at");
const userStats = assured<Answer<"/v1/users/stats">>()(
  "total",
  "active",
  "suspended",
  "invited",
  "mfa_enabled",
  "mfa_missing",
  "new_last_30d",
);
const userTrends = assured<Answer<"/v1/users/trends">>()("total", "mfa_enabled");
const deletedPage = assuredItems<Answer<"/v1/users/deleted">>()(
  "id",
  "email",
  "deleted_at",
  "created_at",
);

/** A member of the organisation, as the list has them (with roles, two-step and last seen). */
export type User = z.output<typeof userPage>["items"][number];
export type UserPage = z.output<typeof userPage>;

/** The most people the Users list loads, 200 at a time, to filter, count and sort itself. */
export const DIRECTORY_CAP = 2000;
const DIRECTORY_PAGE = 200;

/** Everyone in the organisation, up to DIRECTORY_CAP; `complete` is false when there are more. */
export type UserDirectory = { items: User[]; complete: boolean };

/** Tenant-wide member counts. */
export type UserStats = z.output<typeof userStats>;
/** Daily counts over the last 30 days, oldest first. */
export type UserTrends = z.output<typeof userTrends>;
/** A soft-deleted user, restorable until purged; `deleted_by` when the server knows. */
export type DeletedUser = z.output<typeof deletedPage>["items"][number];

/** Query definitions for the users reads, shared by hooks, prefetches and cache reads. */
export const userQueries = {
  list: (organizationId: string | null, params: UserListParams) =>
    queryOptions({
      queryKey: userKeys.list(organizationId, params),
      queryFn: () => backend.get("/v1/users", { query: params, schema: userPage }),
      enabled: !!organizationId,
    }),
  // The list API has no filters or counts of its own yet, so the Users list walks it with the
  // cursor and works over everyone it got.
  directory: (organizationId: string | null) =>
    queryOptions({
      queryKey: userKeys.directory(organizationId),
      queryFn: async ({ signal }): Promise<UserDirectory> => {
        const items: User[] = [];
        let cursor: string | undefined;
        do {
          const page: UserPage = await backend.get("/v1/users", {
            query: { limit: DIRECTORY_PAGE, cursor },
            signal,
            schema: userPage,
          });
          items.push(...page.items);
          cursor = page.next_cursor || undefined;
        } while (cursor && items.length < DIRECTORY_CAP);
        return { items, complete: !cursor };
      },
      enabled: !!organizationId,
      staleTime: 30_000,
    }),
  detail: (organizationId: string | null, userId: string) =>
    queryOptions({
      queryKey: userKeys.detail(organizationId, userId),
      queryFn: () => backend.get("/v1/users/{id}", { path: { id: userId }, schema: userRecord }),
      enabled: !!organizationId && !!userId,
    }),
  stats: (organizationId: string | null) =>
    queryOptions({
      queryKey: userKeys.stats(organizationId),
      queryFn: () => backend.get("/v1/users/stats", { schema: userStats }),
      enabled: !!organizationId,
      staleTime: 30_000,
    }),
  trends: (organizationId: string | null) =>
    queryOptions({
      queryKey: userKeys.trends(organizationId),
      queryFn: () => backend.get("/v1/users/trends", { schema: userTrends }),
      enabled: !!organizationId,
      staleTime: 60_000,
    }),
  deleted: (organizationId: string | null) =>
    queryOptions({
      queryKey: userKeys.deleted(organizationId),
      queryFn: () => backend.get("/v1/users/deleted", { schema: deletedPage }),
      enabled: !!organizationId,
    }),
};

/** Refreshes what a change to who's in the tenant can move: the lists and the counts. */
function refreshMembership(qc: QueryClient, organizationId: string | null) {
  void qc.invalidateQueries({ queryKey: userKeys.lists(organizationId) });
  void qc.invalidateQueries({ queryKey: userKeys.stats(organizationId) });
  void qc.invalidateQueries({ queryKey: userKeys.trends(organizationId) });
}

/** Refreshes the membership views and every view of one user. */
function refreshUser(qc: QueryClient, organizationId: string | null, userId: string) {
  refreshMembership(qc, organizationId);
  void qc.invalidateQueries({ queryKey: userKeys.user(organizationId, userId) });
}

export function useUserDirectory() {
  return useQuery(userQueries.directory(useOrganizationId()));
}

export function useUser(userId: string) {
  return useQuery(userQueries.detail(useOrganizationId(), userId));
}

export function useUserStats(enabled = true) {
  const options = userQueries.stats(useOrganizationId());
  return useQuery({ ...options, enabled: options.enabled && enabled });
}

export function useUserTrends() {
  return useQuery(userQueries.trends(useOrganizationId()));
}

export function useDeletedUsers() {
  return useQuery(userQueries.deleted(useOrganizationId()));
}

/** A new member, in the organisation `organization_id`; `role_id` is assigned straight after. */
export type CreateUserInput = Body<"/v1/users", "post"> & { role_id?: string };
export type UpdateUserBody = Pick<Body<"/v1/users/{id}", "patch">, "display_name" | "phone"> & {
  status?: "active" | "suspended";
};

/**
 * Creates a user, then assigns `role_id` when given. If the assignment fails the mutation
 * rejects, but the user still exists.
 */
export function useCreateUser() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const { role_id, ...body } = input;
      const user = await backend.post("/v1/users", { body, schema: userRecord });
      if (role_id) {
        try {
          await assignRoleCall(body.organization_id, role_id)(user.id);
        } catch (err) {
          // The user exists even though the role didn't stick, so the list must show it.
          refreshMembership(qc, organizationId);
          throw err;
        }
      }
      return user;
    },
    onSuccess: () => refreshMembership(qc, organizationId),
    meta: { successMessage: "users:toast.created" },
  });
}

export function useUpdateUser() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: UpdateUserBody }) =>
      backend.patch("/v1/users/{id}", { path: { id: userId }, body }),
    onSuccess: (_, { userId }) => refreshUser(qc, organizationId, userId),
    meta: { successMessage: "users:toast.updated" },
  });
}

export function useSetUserStatus() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: "active" | "suspended" }) =>
      backend.patch("/v1/users/{id}", { path: { id: userId }, body: { status } }),
    onSuccess: (_, { userId }) => {
      refreshUser(qc, organizationId, userId);
      void qc.invalidateQueries({ queryKey: userKeys.suspended(organizationId) });
    },
    meta: { successMessage: "users:toast.userStatusUpdated" },
  });
}

/** Soft-deletes a user; it stays restorable until purged. */
export function useDeleteUser() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => perUserCalls.remove(userId),
    onSuccess: (_, userId) => {
      refreshUser(qc, organizationId, userId);
      void qc.invalidateQueries({ queryKey: userKeys.deleted(organizationId) });
    },
    meta: { successMessage: "users:toast.deleted" },
  });
}

/** Restores a soft-deleted user. */
export function useRestoreUser() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => perUserCalls.restore(userId),
    onSuccess: () => {
      refreshMembership(qc, organizationId);
      void qc.invalidateQueries({ queryKey: userKeys.deleted(organizationId) });
    },
    meta: { successMessage: "users:toast.userRestored" },
  });
}

/** Erases a soft-deleted user for good. */
export function usePurgeUser() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => perUserCalls.purge(userId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: userKeys.deleted(organizationId) }),
    meta: { successMessage: "users:toast.userPermanentlyDeleted" },
  });
}

/**
 * Clears every MFA factor the user enrolled, so they enroll again at next sign-in. The server
 * requires user.write and audits the reset.
 */
export function useResetUserMfa() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => backend.delete("/v1/users/{id}/mfa", { path: { id: userId } }),
    onSuccess: (_, userId) => refreshUser(qc, organizationId, userId),
    meta: { successMessage: "users:toast.mfaReset" },
  });
}

/**
 * Sets someone's password. The server ends every way they're signed in and emails them that an
 * administrator changed it, so their sessions and devices are read again.
 */
export function useSetUserPassword() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      backend.post("/v1/users/{id}/password", { path: { id: userId }, body: { password } }),
    onSuccess: (_, { userId }) => refreshUser(qc, organizationId, userId),
    meta: { successMessage: "users:toast.passwordUpdated" },
  });
}

/** Assigns a role to a user in the current tenant. */
export function useAssignRole() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => {
      if (!organizationId) throw new Error("No tenant selected");
      return assignRoleCall(organizationId, roleId)(userId);
    },
    onSuccess: (_, { userId }) => refreshUser(qc, organizationId, userId),
    meta: { successMessage: "users:toast.roleAssigned" },
  });
}

/** The per-row outcome of a bulk import, each error on the file's own line. */
export type BulkImportResult = Omit<Answer<"/v1/users/bulk", "post">, "errors"> & {
  errors?: ImportRowError[];
};

/** Creates the rows' users in one request; each row succeeds or fails on its own. */
export function useBulkImportUsers() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: ImportRow[]): Promise<BulkImportResult> => {
      const res = await backend.post("/v1/users/bulk", {
        body: {
          organization_id: organizationId,
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
    onSuccess: () => refreshMembership(qc, organizationId),
    meta: { silent: true }, // the page shows the outcome, and any error, itself
  });
}

function assignRoleCall(organizationId: string, roleId: string) {
  return (userId: string) =>
    backend.post("/v1/users/{userID}/organizations/{organizationID}/roles/{roleID}", {
      path: { userID: userId, organizationID: organizationId, roleID: roleId },
    });
}

/**
 * The per-user calls a bulk action makes for each selected user; there is no batch endpoint.
 * The caller refreshes the users views once the batch is done.
 */
export const perUserCalls = {
  assignRole: assignRoleCall,
  addToGroup: (groupId: string) => (userId: string) =>
    backend.post("/v1/groups/{id}/members/{userID}", { path: { id: groupId, userID: userId } }),
  requireMfa: (userId: string) =>
    backend.put("/v1/users/{id}/mfa-required", { path: { id: userId }, body: { required: true } }),
  revokeSessions: (userId: string) =>
    backend.post("/v1/users/{id}/sessions/revoke-all", { path: { id: userId } }),
  suspend: (userId: string) =>
    backend.patch("/v1/users/{id}", { path: { id: userId }, body: { status: "suspended" } }),
  remove: (userId: string) => backend.delete("/v1/users/{id}", { path: { id: userId } }),
  restore: (userId: string) => backend.post("/v1/users/{id}/restore", { path: { id: userId } }),
  purge: (userId: string) => backend.delete("/v1/users/{id}/purge", { path: { id: userId } }),
};
