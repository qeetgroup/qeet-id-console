import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
export const ROLES_KEY = ["roles"] as const;

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

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
  is_system: boolean;
  created_at: string;
}

export function usePermissions() {
  return useQuery({
    queryKey: ["permissions"],
    queryFn: () => api<{ items: Permission[] }>("/v1/permissions"),
  });
}

export function useRoles() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...ROLES_KEY, tenantId],
    enabled: !!tenantId,
    queryFn: () => api<{ items: Role[] }>(`/v1/tenants/${tenantId}/roles`),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLES_KEY }),
    meta: { successMessage: "Role created" },
  });
}

export function useRolePermissions(roleId: string | null) {
  return useQuery({
    queryKey: ["role-permissions", roleId],
    enabled: !!roleId,
    queryFn: () => api<{ items: Permission[] }>(`/v1/roles/${roleId}/permissions`),
  });
}

export function useGrantPermission(roleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (permId: string) =>
      api<void>(`/v1/roles/${roleId}/permissions/${permId}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role-permissions", roleId] }),
    meta: { successMessage: "Permission granted" },
  });
}

export function useRevokePermission(roleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (permId: string) =>
      api<void>(`/v1/roles/${roleId}/permissions/${permId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role-permissions", roleId] }),
    meta: { successMessage: "Permission revoked" },
  });
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
