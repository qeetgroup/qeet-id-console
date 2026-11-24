import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { authzKeys } from "./keys";

export type GroupRole =
  Answer<"/v1/organizations/{organizationID}/groups/{groupID}/roles">["items"][number];

/** A group's roles as query options, so a list can read several groups' at once. */
export const groupRoleQueries = {
  list: (organizationId: string | null, groupId: string) =>
    queryOptions({
      queryKey: authzKeys.groupRoles(organizationId, groupId),
      enabled: !!organizationId && !!groupId,
      queryFn: () =>
        backend.get("/v1/organizations/{organizationID}/groups/{groupID}/roles", {
          path: { organizationID: organizationId ?? "", groupID: groupId },
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
