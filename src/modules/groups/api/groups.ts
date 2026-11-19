// Group directory data layer: the groups themselves, the reusable templates that
// can create a whole tree at once, and bulk import.

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import { ApiError } from "@/platform/api/client";
import type { Answer, Body } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";

import { groupKeys } from "./keys";

/** A group; `member_count` is set by the list only, create and update answer 0. */
export type Group = Answer<"/v1/organizations/{organizationID}/groups">["items"][number];
/** A reusable tree of groups; `group_count` is how many applying it would create. */
export type GroupTemplate = Answer<"/v1/groups/templates">["items"][number];
export type GroupTemplateNode = GroupTemplate["nodes"][number];
/** One row of an import; `parent` names a group, existing or imported earlier in the file. */
export type ImportRow = Body<"/v1/groups/import", "post">["groups"][number];
/** What an import did, row by row; a row's `reason` is the server's text and isn't shown. */
export type ImportResult = Answer<"/v1/groups/import", "post">;
/** A user in a group, as the members endpoint lists them. */
export type GroupMember = Answer<"/v1/groups/{id}/members">["items"][number];

/** Query definitions for the groups reads, shared by hooks and other modules' summaries. */
export const groupQueries = {
  list: (organizationId: string | null) =>
    queryOptions({
      queryKey: groupKeys.list(organizationId),
      queryFn: () =>
        backend.get("/v1/organizations/{organizationID}/groups", {
          path: { organizationID: organizationId ?? "" },
        }),
      enabled: !!organizationId,
    }),
  members: (organizationId: string | null, groupId: string) =>
    queryOptions({
      queryKey: groupKeys.members(organizationId, groupId),
      queryFn: async (): Promise<{ items: GroupMember[] }> => {
        try {
          return await backend.get("/v1/groups/{id}/members", { path: { id: groupId } });
        } catch (err) {
          // A group created empty may have no membership rows yet: no members, not an error.
          if (err instanceof ApiError && err.status === 404) return { items: [] };
          throw err;
        }
      },
      enabled: !!organizationId && !!groupId,
    }),
  templates: (organizationId: string | null) =>
    queryOptions({
      queryKey: groupKeys.templates(organizationId),
      queryFn: () => backend.get("/v1/groups/templates"),
      enabled: !!organizationId,
    }),
};

export function useGroups() {
  return useQuery(groupQueries.list(useOrganizationId()));
}

export function useGroupMembers(groupId: string) {
  return useQuery(groupQueries.members(useOrganizationId(), groupId));
}

export function useGroupTemplates() {
  return useQuery(groupQueries.templates(useOrganizationId()));
}

export function useCreateGroup() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { name: string; description?: string; parent_id?: string | null }) =>
      backend.post("/v1/groups", { body: in_ }),
    onSuccess: () => qc.invalidateQueries({ queryKey: groupKeys.list(organizationId) }),
    meta: { successMessage: "groups:toast.created" },
  });
}

export interface UpdateGroupInput {
  name: string;
  description: string;
  parent_id: string | null;
}

export function useUpdateGroup() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, body }: { groupId: string; body: UpdateGroupInput }) =>
      backend.patch("/v1/groups/{id}", { path: { id: groupId }, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: groupKeys.list(organizationId) }),
    meta: { successMessage: "groups:toast.updated", silentError: true }, // the sheet shows the error
  });
}

/** Deletes a group, dropping it from the list at once and restoring it if the call fails. */
export function useDeleteGroup() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  const listKey = groupKeys.list(organizationId);
  return useMutation({
    mutationFn: (groupId: string) => backend.delete("/v1/groups/{id}", { path: { id: groupId } }),
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
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { groupId: string; userId: string }) =>
      backend.post("/v1/groups/{id}/members/{userID}", {
        path: { id: in_.groupId, userID: in_.userId },
      }),
    onSuccess: (_, { groupId }) => {
      void qc.invalidateQueries({ queryKey: groupKeys.members(organizationId, groupId) });
      void qc.invalidateQueries({ queryKey: groupKeys.list(organizationId) }); // member counts
    },
    meta: silent
      ? { silent: true }
      : { successMessage: "groups:toast.memberAdded", silentError: true },
  });
}

export function useRemoveGroupMember() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { groupId: string; userId: string }) =>
      backend.delete("/v1/groups/{id}/members/{userID}", {
        path: { id: in_.groupId, userID: in_.userId },
      }),
    onSuccess: (_, { groupId }) => {
      void qc.invalidateQueries({ queryKey: groupKeys.members(organizationId, groupId) });
      void qc.invalidateQueries({ queryKey: groupKeys.list(organizationId) });
    },
    meta: { successMessage: "groups:toast.memberRemoved" },
  });
}

/**
 * Grants a role to a newly created group so its members inherit it. Unlike `useGrantGroupRole`,
 * it takes the group id per call: the create flow learns the id only after creating.
 */
export function useAssignGroupRole() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { groupId: string; roleId: string }) =>
      backend.post("/v1/organizations/{organizationID}/groups/{groupID}/roles/{roleID}", {
        path: { organizationID: organizationId ?? "", groupID: in_.groupId, roleID: in_.roleId },
      }),
    // The authorization module loads only now: this file is in the groups barrel, which the shell
    // imports (the list's route reads its search schema from it), so it stays light.
    onSuccess: async (_, in_) => {
      const { authzKeys } = await import("@/modules/authorization");
      await qc.invalidateQueries({ queryKey: authzKeys.groupRoles(organizationId, in_.groupId) });
    },
    meta: { silent: true }, // part of the create flow, which toasts "Group created"
  });
}

export function useCreateGroupTemplate() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { name: string; description?: string; nodes: GroupTemplateNode[] }) =>
      backend.post("/v1/groups/templates", { body: in_ }),
    onSuccess: () => qc.invalidateQueries({ queryKey: groupKeys.templates(organizationId) }),
    meta: { successMessage: "groups:toast.templateSaved" },
  });
}

export function useDeleteGroupTemplate() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backend.delete("/v1/groups/templates/{id}", { path: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: groupKeys.templates(organizationId) }),
    meta: { successMessage: "groups:toast.templateDeleted" },
  });
}

export function useApplyGroupTemplate() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { id: string; parent_id?: string | null }) =>
      backend.post("/v1/groups/templates/{id}/apply", {
        path: { id: in_.id },
        body: { parent_id: in_.parent_id ?? null },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: groupKeys.list(organizationId) }),
    meta: { successMessage: "groups:toast.templateApplied" },
  });
}

export function useImportGroups() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groups: ImportRow[]) => backend.post("/v1/groups/import", { body: { groups } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: groupKeys.list(organizationId) }),
    meta: { silent: true }, // the dialog shows a per-row breakdown instead
  });
}
