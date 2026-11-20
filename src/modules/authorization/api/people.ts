import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { strictly } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { authzKeys } from "./keys";

// GET /v1/users/{id}/access: what a person holds in this organisation (user.read). The server
// always sends these (internal/identity/user/user360.go, AccessSummary); the document marks them
// optional.
const named = z.object({ id: z.string(), name: z.string() });
const personAccess = strictly<Answer<"/v1/users/{id}/access">>()(
  z.object({
    roles: z.array(named),
    groups: z.array(named),
    permissions_direct: z.number(), // distinct, from roles assigned to them
    permissions_inherited: z.number(), // only through their groups
    permissions_total: z.number(),
  }),
);
export type PersonAccess = z.infer<typeof personAccess>;

/**
 * The roles, groups and permission counts of the person a check is about. The users module has
 * the same read for its own pages; it isn't in that module's public API, so this asks for it here.
 */
export function usePersonAccess(userId: string | null, enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: [...authzKeys.organization(organizationId), "person-access", userId],
    enabled: !!organizationId && !!userId && enabled,
    queryFn: () =>
      backend.get("/v1/users/{id}/access", { path: { id: userId ?? "" }, schema: personAccess }),
    staleTime: 30_000,
  });
}
