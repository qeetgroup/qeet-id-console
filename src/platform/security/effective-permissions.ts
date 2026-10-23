import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

// Fails closed: a malformed payload throws rather than become a capability set that mis-gates
// the whole UI.
const effectivePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

/**
 * Returns the operator's own resolved permissions (direct, role and group) as opaque strings;
 * the query client invalidates this key on any 403. UX only: the backend authorizes.
 */
export function useEffectivePermissions(userId: string | null) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["effective-permissions", tenantId, userId],
    enabled: !!tenantId && !!userId,
    staleTime: 60_000,
    retry: false,
    meta: { silent: true },
    queryFn: () =>
      api(`/v1/users/${userId}/tenants/${tenantId}/permissions`, {
        schema: effectivePermissionsSchema,
      }),
  });
}
