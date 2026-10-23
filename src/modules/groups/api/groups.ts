// Group directory data layer: the groups themselves, the reusable templates that
// can create a whole tree at once, and bulk import.

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authzKeys } from "@/modules/authorization";
import { ApiError, api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import { groupKeys } from "./keys";

export interface Group {
  id: string;
  tenant_id: string;
  parent_id?: string | null;
  name: string;
  description: string;
  created_at: string;
  member_count: number; // set by the list endpoint only; create and update return 0
}

export interface GroupTemplateNode {
  name: string;
  description?: string;
  children?: GroupTemplateNode[];
}

export interface GroupTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  nodes: GroupTemplateNode[];
  created_at: string;
  group_count: number; // groups that applying the template would create
}

export interface ImportRow {
  name: string;
  description?: string;
  parent?: string; // parent group name, resolved against existing and imported rows
}

export interface ImportResult {
  created: number;
  skipped: number;
  failed: number;
  // Each row's `reason` is the server's own text and isn't shown; its `code` picks the wording.
  rows: { name: string; status: "created" | "skipped" | "failed"; code?: string; field?: string }[];
}

/** A user in a group, as the members endpoint lists them. */
export interface GroupMember {
  user_id: string;
  email: string;
  display_name: string | null;
}

/** Query definitions for the groups reads, shared by hooks and other modules' summaries. */
export const groupQueries = {
  list: (tenantId: string | null) =>
    queryOptions({
      queryKey: groupKeys.list(tenantId),
      queryFn: () => api<{ items: Group[] }>(`/v1/tenants/${tenantId}/groups`),
      enabled: !!tenantId,
    }),
  members: (tenantId: string | null, groupId: string) =>
    queryOptions({
      queryKey: groupKeys.members(tenantId, groupId),
      queryFn: async (): Promise<{ items: GroupMember[] }> => {
        try {
          return await api<{ items: GroupMember[] }>(`/v1/groups/${groupId}/members`);
        } catch (err) {
          // A group created empty may have no membership rows yet: no members, not an error.
          if (err instanceof ApiError && err.status === 404) return { items: [] };
          throw err;
        }
      },
      enabled: !!tenantId && !!groupId,
    }),
  templates: (tenantId: string | null) =>
    queryOptions({
      queryKey: groupKeys.templates(tenantId),
      queryFn: () => api<{ items: GroupTemplate[] }>("/v1/groups/templates"),
      enabled: !!tenantId,
    }),
};

export function useGroups() {
  return useQuery(groupQueries.list(useTenantId()));
}

export function useGroupMembers(groupId: string) {
  return useQuery(groupQueries.members(useTenantId(), groupId));
}

export function useGroupTemplates() {
  return useQuery(groupQueries.templates(useTenantId()));
}

export function useCreateGroup() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { name: string; description?: string; parent_id?: string | null }) =>
      api<Group>("/v1/groups", { method: "POST", body: { tenant_id: tenantId, ...in_ } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: groupKeys.list(tenantId) }),
    meta: { successMessage: "groups:toast.created" },
  });
}

export interface UpdateGroupInput {
  name: string;
  description: string;
  parent_id: string | null;
}

export function useUpdateGroup() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, body }: { groupId: string; body: UpdateGroupInput }) =>
      api<Group>(`/v1/groups/${groupId}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: groupKeys.list(tenantId) }),
    meta: { successMessage: "groups:toast.updated", silentError: true }, // the sheet shows the error
  });
}

/** Deletes a group, dropping it from the list at once and restoring it if the call fails. */
export function useDeleteGroup() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const listKey = groupKeys.list(tenantId);
  return useMutation({
    mutationFn: (groupId: string) => api<void>(`/v1/groups/${groupId}`, { method: "DELETE" }),
    onMutate: async (groupId) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<{ items: Group[] }>(listKey);
      qc.setQueryData<{ items: Group[] }>(listKey, (prev) =>
        prev ? { ...prev, items: prev.items.filter((g) => g.id !== groupId) } : prev,
      );
      return { previous };
    },
    onError: (_err, _groupId, ctx) => qc.setQueryData(listKey, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: listKey }),
    meta: { successMessage: "groups:toast.deleted" },
  });
}

/**
 * Adds a user to a group. `silent` drops the toast, for the create flow, where a toast per added
 * member would bury "Group created".
 */
export function useAddGroupMember({ silent = false }: { silent?: boolean } = {}) {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { groupId: string; userId: string }) =>
      api<void>(`/v1/groups/${in_.groupId}/members/${in_.userId}`, { method: "POST" }),
    onSuccess: (_, { groupId }) => {
      void qc.invalidateQueries({ queryKey: groupKeys.members(tenantId, groupId) });
      void qc.invalidateQueries({ queryKey: groupKeys.list(tenantId) }); // member counts
    },
    meta: silent
      ? { silent: true }
      : { successMessage: "groups:toast.memberAdded", silentError: true },
  });
}

export function useRemoveGroupMember() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { groupId: string; userId: string }) =>
      api<void>(`/v1/groups/${in_.groupId}/members/${in_.userId}`, { method: "DELETE" }),
    onSuccess: (_, { groupId }) => {
      void qc.invalidateQueries({ queryKey: groupKeys.members(tenantId, groupId) });
      void qc.invalidateQueries({ queryKey: groupKeys.list(tenantId) });
    },
    meta: { successMessage: "groups:toast.memberRemoved" },
  });
}

/**
 * Grants a role to a newly created group so its members inherit it. Unlike `useGrantGroupRole`,
 * it takes the group id per call: the create flow learns the id only after creating.
 */
export function useAssignGroupRole() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { groupId: string; roleId: string }) =>
      api<void>(`/v1/tenants/${tenantId}/groups/${in_.groupId}/roles/${in_.roleId}`, {
        method: "POST",
      }),
    onSuccess: (_, in_) =>
      qc.invalidateQueries({ queryKey: authzKeys.groupRoles(tenantId, in_.groupId) }),
    meta: { silent: true }, // part of the create flow, which toasts "Group created"
  });
}

export function useCreateGroupTemplate() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { name: string; description?: string; nodes: GroupTemplateNode[] }) =>
      api<GroupTemplate>("/v1/groups/templates", { method: "POST", body: in_ }),
    onSuccess: () => qc.invalidateQueries({ queryKey: groupKeys.templates(tenantId) }),
    meta: { successMessage: "groups:toast.templateSaved" },
  });
}

export function useDeleteGroupTemplate() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/groups/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: groupKeys.templates(tenantId) }),
    meta: { successMessage: "groups:toast.templateDeleted" },
  });
}

export function useApplyGroupTemplate() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { id: string; parent_id?: string | null }) =>
      api<{ items: Group[] }>(`/v1/groups/templates/${in_.id}/apply`, {
        method: "POST",
        body: { parent_id: in_.parent_id ?? null },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: groupKeys.list(tenantId) }),
    meta: { successMessage: "groups:toast.templateApplied" },
  });
}

export function useImportGroups() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groups: ImportRow[]) =>
      api<ImportResult>("/v1/groups/import", { method: "POST", body: { groups } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: groupKeys.list(tenantId) }),
    meta: { silent: true }, // the dialog shows a per-row breakdown instead
  });
}
