import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authzKeys } from "./keys";

/** GET /v1/users/{id}/access: what a person holds in this organisation (user.read). */
export interface PersonAccess {
  roles: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  permissions_direct: number; // distinct, from roles assigned to them
  permissions_inherited: number; // only through their groups
  permissions_total: number;
}

/**
 * The roles, groups and permission counts of the person a check is about. The users module has
 * the same read for its own pages; it isn't in that module's public API, so this asks for it here.
 */
export function usePersonAccess(userId: string | null, enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...authzKeys.tenant(tenantId), "person-access", userId],
    enabled: !!tenantId && !!userId && enabled,
    queryFn: () => api<PersonAccess>(`/v1/users/${userId}/access`),
    staleTime: 30_000,
  });
}
