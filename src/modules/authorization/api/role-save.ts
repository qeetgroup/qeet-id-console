// The role drawer's one save. The server changes a role's permissions one at a time (there's no
// call that sets them all), so the save sends each grant and revoke in turn, behind the one step-up
// the first of them asks for, and refreshes the role once at the end, whatever got through.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authzKeys } from "./keys";

export type RolePermissionChange = {
  /** Permission IDs to give the role. */
  grant: readonly string[];
  /** Permission IDs to take from it. */
  revoke: readonly string[];
};

export function useSaveRolePermissions(roleId: string) {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ grant, revoke }: RolePermissionChange) => {
      // In turn, not at once: the first call's step-up covers the rest.
      for (const id of grant) {
        await api<void>(`/v1/roles/${roleId}/permissions/${id}`, { method: "POST" });
      }
      for (const id of revoke) {
        await api<void>(`/v1/roles/${roleId}/permissions/${id}`, { method: "DELETE" });
      }
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: authzKeys.rolePermissions(tenantId, roleId) }),
    meta: { successMessage: "authorization:toast.roleSaved", silentError: true }, // the drawer shows it
  });
}
