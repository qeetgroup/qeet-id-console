import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { backend } from "@/platform/api/backend";
import { useOrganizationId } from "@/platform/auth/session";

// Fails closed: a malformed payload throws rather than become a capability set that mis-gates
// the whole UI.
// No permissions listed means none: the narrowest reading.
const effectivePermissionsSchema = z.object({
  permissions: z
    .array(z.string())
    .optional()
    .transform((permissions) => permissions ?? []),
});

/**
 * Returns the operator's own resolved permissions (direct, role and group) as opaque strings;
 * the query client invalidates this key on any 403. UX only: the backend authorizes.
 */
export function useEffectivePermissions(userId: string | null) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: ["effective-permissions", organizationId, userId],
    enabled: !!organizationId && !!userId,
    staleTime: 60_000,
    retry: false,
    meta: { silent: true },
    queryFn: () =>
      backend.get("/v1/users/{userID}/organizations/{organizationID}/permissions", {
        path: { userID: userId ?? "", organizationID: organizationId ?? "" },
        schema: effectivePermissionsSchema,
      }),
  });
}
