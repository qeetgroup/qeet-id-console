import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authzKeys } from "./keys";

export interface Permission {
  id: string;
  key: string;
  description: string;
}

export interface Role {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  is_system: boolean; // a built-in role, which can't be deleted
  created_at: string;
}

/** Query definitions for role reads; `list` takes any tenant the caller belongs to. */
export const roleQueries = {
  list: (tenantId: string | null) =>
    queryOptions({
      queryKey: authzKeys.roles(tenantId),
      queryFn: () => api<{ items: Role[] }>(`/v1/tenants/${tenantId}/roles`),
      enabled: !!tenantId,
    }),
  /** A role's permissions; a list reads every role's at once. */
  permissions: (tenantId: string | null, roleId: string | null) =>
    queryOptions({
      queryKey: authzKeys.rolePermissions(tenantId, roleId),
      enabled: !!tenantId && !!roleId,
      queryFn: () => api<{ items: Permission[] }>(`/v1/roles/${roleId}/permissions`),
    }),
};

export function useRoles() {
  return useQuery(roleQueries.list(useTenantId()));
}

/** The permissions a role can be granted. */
export function usePermissions(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: authzKeys.permissions(tenantId),
    queryFn: () => api<{ items: Permission[] }>("/v1/permissions"),
    enabled,
  });
}

export function useCreateRole() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description: string }) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<Role>(`/v1/tenants/${tenantId}/roles`, { method: "POST", body });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: authzKeys.roles(tenantId) }),
    meta: { successMessage: "authorization:toast.roleCreated", silentError: true }, // the sheet shows it
  });
}

export function useRolePermissions(roleId: string | null) {
  return useQuery(roleQueries.permissions(useTenantId(), roleId));
}

export { useEffectivePermissions } from "@/platform/security/effective-permissions";

/** Returns permissions grouped by resource: the part of the key before the first dot. */
export function groupPermissionsByResource(perms: Permission[]): Map<string, Permission[]> {
  const groups = new Map<string, Permission[]>();
  for (const p of perms) {
    const resource = p.key.includes(".") ? p.key.slice(0, p.key.indexOf(".")) : p.key;
    const bucket = groups.get(resource) ?? [];
    bucket.push(p);
    groups.set(resource, bucket);
  }
  return groups;
}

/** Returns the permissions whose key contains a wildcard, which the console flags as a risk. */
export function wildcardPermissions(perms: Permission[]): Permission[] {
  return perms.filter((p) => p.key.includes("*"));
}
