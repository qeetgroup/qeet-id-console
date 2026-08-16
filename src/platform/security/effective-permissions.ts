import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

// Runtime contract for the capability source. Parsing fails CLOSED: a malformed
// payload throws instead of silently becoming a garbage capability Set (which
// would otherwise mis-gate the whole UI).
const effectivePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

// The operator's OWN resolved capability set (direct ∪ role ∪ group), fetched
// from the backend and mirrored into a Set by the capability provider. This is
// the session's capability source and the key the query client invalidates on
// any 403 — hence it lives in platform/security, not with the authorization
// management screens (features/authorization).
//
// Returns opaque permission strings; classification/derivation lives in
// capability-model. UX-only — the backend remains the authorization boundary.
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
