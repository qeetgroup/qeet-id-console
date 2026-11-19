import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";

import { assured, assuredItems } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { authzKeys } from "./keys";

// The server always sends these (internal/access/authorization/rbac/rbac.go); the document marks
// them optional (QTID-1063). A system role is built in and can't be deleted.
const ROLE_FIELDS = [
  "id",
  "organization_id",
  "name",
  "description",
  "is_system",
  "created_at",
] as const;
const PERMISSION_FIELDS = ["id", "key", "description"] as const;
const roleList = assuredItems<Answer<"/v1/organizations/{organizationID}/roles">>()(...ROLE_FIELDS);
const createdRole = assured<Answer<"/v1/organizations/{organizationID}/roles", "post">>()(
  ...ROLE_FIELDS,
);
const catalogue = assuredItems<Answer<"/v1/permissions">>()(...PERMISSION_FIELDS);
const rolePermissions = assuredItems<Answer<"/v1/roles/{roleID}/permissions">>()(
  ...PERMISSION_FIELDS,
);
export type Role = z.infer<typeof roleList>["items"][number];
export type Permission = z.infer<typeof catalogue>["items"][number];

/** Query definitions for role reads; `list` takes any tenant the caller belongs to. */
export const roleQueries = {
  list: (organizationId: string | null) =>
    queryOptions({
      queryKey: authzKeys.roles(organizationId),
      queryFn: () =>
        backend.get("/v1/organizations/{organizationID}/roles", {
          path: { organizationID: organizationId ?? "" },
          schema: roleList,
        }),
      enabled: !!organizationId,
    }),
  /** A role's permissions; a list reads every role's at once. */
  permissions: (organizationId: string | null, roleId: string | null) =>
    queryOptions({
      queryKey: authzKeys.rolePermissions(organizationId, roleId),
      enabled: !!organizationId && !!roleId,
      queryFn: () =>
        backend.get("/v1/roles/{roleID}/permissions", {
          path: { roleID: roleId ?? "" },
          schema: rolePermissions,
        }),
    }),
};

export function useRoles() {
  return useQuery(roleQueries.list(useOrganizationId()));
}

/** The permissions a role can be granted. */
export function usePermissions(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: authzKeys.permissions(organizationId),
    queryFn: () => backend.get("/v1/permissions", { schema: catalogue }),
    enabled,
  });
}

export function useCreateRole() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description: string }) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.post("/v1/organizations/{organizationID}/roles", {
        path: { organizationID: organizationId },
        body,
        schema: createdRole,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: authzKeys.roles(organizationId) }),
    meta: { successMessage: "authorization:toast.roleCreated", silentError: true }, // the sheet shows it
  });
}

export function useRolePermissions(roleId: string | null) {
  return useQuery(roleQueries.permissions(useOrganizationId(), roleId));
}

export { useEffectivePermissions } from "@/platform/security/effective-permissions";

/** Returns permissions grouped by resource: the part of the key before the first dot. */
export function groupPermissionsByResource(perms: Permission[]): Map<string, Permission[]> {
  const groups = new Map<string, Permission[]>();
  for (const p of perms) {
    const resource = p.key.includes(".") ? p.key.slice(0, p.key.indexOf(".")) : p.key;
    const bucket = groups.get(resource) ?? [];
    bucket.push(p);
    groups.set(resource, bucket);
  }
  return groups;
}

/** Returns the permissions whose key contains a wildcard, which the console flags as a risk. */
export function wildcardPermissions(perms: Permission[]): Permission[] {
  return perms.filter((p) => p.key.includes("*"));
}
