import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authzKeys } from "./keys";

export interface GroupRole {
  role_id: string;
  name: string;
  granted_at: string;
}

/** A group's roles as query options, so a list can read several groups' at once. */
export const groupRoleQueries = {
  list: (tenantId: string | null, groupId: string) =>
    queryOptions({
      queryKey: authzKeys.groupRoles(tenantId, groupId),
      enabled: !!tenantId && !!groupId,
      queryFn: () => api<{ items: GroupRole[] }>(`/v1/tenants/${tenantId}/groups/${groupId}/roles`),
    }),
};

export function useGroupRoles(groupId: string) {
  return useQuery(groupRoleQueries.list(useTenantId(), groupId));
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
    onSuccess: () => qc.invalidateQueries({ queryKey: authzKeys.groupRoles(tenantId, groupId) }),
    meta: { successMessage: "authorization:toast.roleGrantedToGroup" },
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
    onSuccess: () => qc.invalidateQueries({ queryKey: authzKeys.groupRoles(tenantId, groupId) }),
    meta: { successMessage: "authorization:toast.roleRevokedFromGroup" },
  });
}
