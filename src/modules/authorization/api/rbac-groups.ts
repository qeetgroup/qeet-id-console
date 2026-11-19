import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";

import { assuredItems } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { authzKeys } from "./keys";

// The server always sends these (internal/access/authorization/rbac/rbac.go, GroupRole); the
// document marks them optional (QTID-1063).
const groupRoles = assuredItems<
  Answer<"/v1/organizations/{organizationID}/groups/{groupID}/roles">
>()("role_id", "name", "granted_at");
export type GroupRole = z.infer<typeof groupRoles>["items"][number];

/** A group's roles as query options, so a list can read several groups' at once. */
export const groupRoleQueries = {
  list: (organizationId: string | null, groupId: string) =>
    queryOptions({
      queryKey: authzKeys.groupRoles(organizationId, groupId),
      enabled: !!organizationId && !!groupId,
      queryFn: () =>
        backend.get("/v1/organizations/{organizationID}/groups/{groupID}/roles", {
          path: { organizationID: organizationId ?? "", groupID: groupId },
          schema: groupRoles,
        }),
    }),
};

export function useGroupRoles(groupId: string) {
  return useQuery(groupRoleQueries.list(useOrganizationId(), groupId));
}

/** Grants a role to a group; every member of the group inherits the role's permissions. */
export function useGrantGroupRole(groupId: string) {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.post("/v1/organizations/{organizationID}/groups/{groupID}/roles/{roleID}", {
        path: { organizationID: organizationId, groupID: groupId, roleID: roleId },
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: authzKeys.groupRoles(organizationId, groupId) }),
    meta: { successMessage: "authorization:toast.roleGrantedToGroup" },
  });
}

export function useRevokeGroupRole(groupId: string) {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.delete("/v1/organizations/{organizationID}/groups/{groupID}/roles/{roleID}", {
        path: { organizationID: organizationId, groupID: groupId, roleID: roleId },
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: authzKeys.groupRoles(organizationId, groupId) }),
    meta: { successMessage: "authorization:toast.roleRevokedFromGroup" },
  });
}
