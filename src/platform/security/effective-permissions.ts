import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { strictly } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";

// Fails closed: a malformed payload throws rather than become a capability set that mis-gates
// the whole UI.
const effectivePermissionsSchema = strictly<Answer<"/v1/me/permissions">>()(
  z.object({ permissions: z.array(z.string()) }),
);

/**
 * Returns the operator's own resolved permissions (direct, role and group) as opaque strings, in
 * the organisation their session is for; someone who holds none reads an empty list. The query
 * client invalidates this key on any 403. UX only: the backend authorizes.
 */
export function useEffectivePermissions(userId: string | null) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: ["effective-permissions", organizationId, userId],
    enabled: !!organizationId && !!userId,
    staleTime: 60_000,
    retry: false,
    meta: { silent: true },
    queryFn: ({ signal }) =>
      backend.get("/v1/me/permissions", { signal, schema: effectivePermissionsSchema }),
  });
}
