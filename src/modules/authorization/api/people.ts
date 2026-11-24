import { useQuery } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { authzKeys } from "./keys";

// GET /v1/users/{id}/access: what a person holds in this organisation (user.read).
// `permissions_direct` come from roles assigned to them, `permissions_inherited` only through their
// groups.
export type PersonAccess = Answer<"/v1/users/{id}/access">;

/**
 * The roles, groups and permission counts of the person a check is about. The users module has
 * the same read for its own pages; it isn't in that module's public API, so this asks for it here.
 */
export function usePersonAccess(userId: string | null, enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: [...authzKeys.organization(organizationId), "person-access", userId],
    enabled: !!organizationId && !!userId && enabled,
    queryFn: () => backend.get("/v1/users/{id}/access", { path: { id: userId ?? "" } }),
    staleTime: 30_000,
  });
}
