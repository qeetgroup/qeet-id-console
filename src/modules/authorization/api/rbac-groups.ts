import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

export interface GroupRole {
  role_id: string;
  name: string;
  granted_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  is_system: boolean; // a built-in role, which can't be deleted
  created_at: string;
}

export function useRoles() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["roles", tenantId],
    enabled: !!tenantId,
    queryFn: () => api<{ items: Role[] }>(`/v1/tenants/${tenantId}/roles`),
  });
}

export function useGroupRoles(groupId: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["group-roles", tenantId, groupId],
    enabled: !!tenantId && !!groupId,
    queryFn: () => api<{ items: GroupRole[] }>(`/v1/tenants/${tenantId}/groups/${groupId}/roles`),
  });
}

/** Grants a role to a group; every member of the group inherits the role's permissions. */
export function useGrantGroupRole(groupId: string) {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<void>(`/v1/tenants/${tenantId}/groups/${groupId}/roles/${roleId}`, {
        method: "POST",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["group-roles", tenantId, groupId] }),
    meta: { successMessage: "Role granted to group" },
  });
}

export function useRevokeGroupRole(groupId: string) {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<void>(`/v1/tenants/${tenantId}/groups/${groupId}/roles/${roleId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["group-roles", tenantId, groupId] }),
    meta: { successMessage: "Role revoked from group" },
  });
}
