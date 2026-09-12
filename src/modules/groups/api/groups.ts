// Group directory data layer: the groups themselves, the reusable templates that
// can create a whole tree at once, and bulk import.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

export interface Group {
  id: string;
  tenant_id: string;
  parent_id?: string | null;
  name: string;
  description: string;
  created_at: string;
  /** Populated by the list endpoint only; create/update return 0. */
  member_count: number;
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
  /** How many groups applying this template would create. */
  group_count: number;
}

export interface ImportRow {
  name: string;
  description?: string;
  /** Parent group NAME — resolved server-side against existing and imported rows. */
  parent?: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  failed: number;
  rows: { name: string; status: "created" | "skipped" | "failed"; reason?: string }[];
}

export const GROUPS_KEY = ["groups"] as const;
export const GROUP_TEMPLATES_KEY = ["group-templates"] as const;

export function useGroups() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...GROUPS_KEY, tenantId],
    enabled: !!tenantId,
    queryFn: () => api<{ items: Group[] }>(`/v1/tenants/${tenantId}/groups`),
  });
}

export function useCreateGroup() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { name: string; description?: string; parent_id?: string | null }) =>
      api<Group>("/v1/groups", { method: "POST", body: { tenant_id: tenantId, ...in_ } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: GROUPS_KEY }),
    meta: { successMessage: "Group created" },
  });
}

export function useAddGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { groupId: string; userId: string }) =>
      api<void>(`/v1/groups/${in_.groupId}/members/${in_.userId}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: GROUPS_KEY }),
    // The create flow adds several members in a row; one toast per member would
    // bury the "group created" confirmation.
    meta: { silent: true },
  });
}

/**
 * Grant a role to a newly created group, so its members inherit it.
 *
 * Separate from authorization's `useGrantGroupRole`, which binds the group id at
 * hook-creation time — the create flow doesn't know the id until the group
 * exists.
 */
export function useAssignGroupRole() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { groupId: string; roleId: string }) =>
      api<void>(`/v1/tenants/${tenantId}/groups/${in_.groupId}/roles/${in_.roleId}`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["group-roles"] }),
    // Part of the create flow; "Group created" is the confirmation that matters.
    meta: { silent: true },
  });
}

export function useGroupTemplates() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...GROUP_TEMPLATES_KEY, tenantId],
    enabled: !!tenantId,
    queryFn: () => api<{ items: GroupTemplate[] }>("/v1/groups/templates"),
  });
}

export function useCreateGroupTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { name: string; description?: string; nodes: GroupTemplateNode[] }) =>
      api<GroupTemplate>("/v1/groups/templates", { method: "POST", body: in_ }),
    onSuccess: () => qc.invalidateQueries({ queryKey: GROUP_TEMPLATES_KEY }),
    meta: { successMessage: "Template saved" },
  });
}

export function useDeleteGroupTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/groups/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: GROUP_TEMPLATES_KEY }),
    meta: { successMessage: "Template deleted" },
  });
}

export function useApplyGroupTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { id: string; parent_id?: string | null }) =>
      api<{ items: Group[] }>(`/v1/groups/templates/${in_.id}/apply`, {
        method: "POST",
        body: { parent_id: in_.parent_id ?? null },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: GROUPS_KEY }),
    meta: { successMessage: "Template applied" },
  });
}

export function useImportGroups() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groups: ImportRow[]) =>
      api<ImportResult>("/v1/groups/import", { method: "POST", body: { groups } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: GROUPS_KEY }),
    // The dialog renders a per-row breakdown; a toast saying "Saved" on top of
    // "3 created, 1 skipped, 2 failed" would be noise at best.
    meta: { silent: true },
  });
}
