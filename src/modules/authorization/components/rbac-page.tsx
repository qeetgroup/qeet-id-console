import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { ShieldCheckIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import { RoleHierarchyGraph } from "./graph/role-hierarchy-graph";
import { useRolePermissions, useRoles } from "../api/rbac";

/** Renders the role hierarchy and each role's permissions. */
export function RbacPage() {
  const { t } = useTranslation("rbac");
  const rolesQ = useRoles();
  const roles = rolesQ.data?.items ?? [];
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const permsQ = useRolePermissions(selectedRoleId);
  const permissions = permsQ.data?.items ?? [];
  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("rbacPage.visualiseHowRolesGrant")} />

      <DataState
        isLoading={rolesQ.isLoading}
        isError={rolesQ.isError}
        error={rolesQ.error}
        isEmpty={roles.length === 0}
        emptyIcon={ShieldCheckIcon}
        emptyTitle={t("rbacPage.noRolesToVisualiseYet")}
        skeletonRows={4}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="min-w-0">
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">{t("rbacPage.rolePermissionGraph")}</CardTitle>
                <CardDescription>
                  {selectedRole
                    ? t("rbacPage.showingGrantsFor", { name: selectedRole.name })
                    : t("rbacPage.selectARole")}
                </CardDescription>
              </div>
              {selectedRole && (
                <Button variant="outline" size="sm" onClick={() => setSelectedRoleId(null)}>
                  {t("rbacPage.clearSelection")}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <RoleHierarchyGraph
                roles={roles}
                selectedRoleId={selectedRoleId}
                permissions={permissions}
                onSelectRole={setSelectedRoleId}
                height={520}
              />
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base">
                {selectedRole ? selectedRole.name : t("rbacPage.roleDetails")}
              </CardTitle>
              <CardDescription>
                {selectedRole
                  ? selectedRole.description || t("permissions.noDescription")
                  : t("rbacPage.clickARoleNode")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedRole ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("rbacPage.nothingSelected")}
                </p>
              ) : (
                <DataState
                  isLoading={permsQ.isLoading}
                  isError={permsQ.isError}
                  error={permsQ.error}
                  isEmpty={permissions.length === 0}
                  emptyIcon={ShieldCheckIcon}
                  emptyTitle={t("rbacPage.thisRoleGrantsNoPermissions")}
                  skeletonRows={4}
                >
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      {t("rbacPage.grantedCount", { count: permissions.length })}
                    </p>
                    {permissions.map((p) => (
                      <div key={p.id} className="rounded-md border p-2">
                        <code className="text-xs font-medium">{p.key}</code>
                        {p.key.includes("*") && (
                          <Badge variant="warning" className="ml-2 text-[10px]">
                            {t("permissionsPage.wildcard")}
                          </Badge>
                        )}
                        <p className="truncate text-xs text-muted-foreground">{p.description}</p>
                      </div>
                    ))}
                  </div>
                </DataState>
              )}
            </CardContent>
          </Card>
        </div>
      </DataState>
    </div>
  );
}
