import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@qeetrix/ui";
import { BuildingComplexIcon, LockIcon, ShieldCheckIcon, UsersRoundIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { DataState } from "@/platform/components/data-state";
import type { AccessSummary } from "../api/user360";
import { CopyId, InfoRow } from "./user-detail-fields";

/** Renders the User 360 Access tab: organization, roles, groups and effective permissions. */
export function AccessTab({
  access,
  loading,
  permissions,
  permissionsLoading,
}: {
  access?: AccessSummary;
  loading: boolean;
  permissions: string[];
  permissionsLoading: boolean;
}) {
  const { t } = useTranslation("users");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BuildingComplexIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              {t("detail.organization")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataState isLoading={loading} isEmpty={!access?.organization} emptyTitle="—">
              {access?.organization ? (
                <div className="divide-y divide-border/50">
                  <InfoRow label={t("detail.name")}>{access.organization.name}</InfoRow>
                  <InfoRow label={t("detail.slug")}>
                    <span className="font-mono text-xs">{access.organization.slug}</span>
                  </InfoRow>
                  <InfoRow label={t("detail.fieldTenant")}>
                    <CopyId value={access.organization.id} />
                  </InfoRow>
                </div>
              ) : null}
            </DataState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheckIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              {t("detail.roles")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataState
              isLoading={loading}
              isEmpty={!access?.roles.length}
              emptyIcon={ShieldCheckIcon}
              emptyTitle={t("detail.noRoles")}
              skeletonRows={2}
            >
              <ul className="divide-y divide-border/50">
                {access?.roles.map((r) => (
                  <li key={r.id} className="flex flex-col gap-0.5 px-6 py-2.5">
                    <span className="text-sm font-medium">{r.name}</span>
                    {r.description ? (
                      <span className="text-xs text-muted-foreground">{r.description}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </DataState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UsersRoundIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              {t("detail.groups")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataState
              isLoading={loading}
              isEmpty={!access?.groups.length}
              emptyIcon={UsersRoundIcon}
              emptyTitle={t("detail.noGroups")}
              skeletonRows={2}
            >
              <ul className="divide-y divide-border/50">
                {access?.groups.map((g) => (
                  <li key={g.id} className="flex flex-col gap-0.5 px-6 py-2.5">
                    <span className="text-sm font-medium">{g.name}</span>
                    {g.description ? (
                      <span className="text-xs text-muted-foreground">{g.description}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </DataState>
          </CardContent>
        </Card>
      </div>

      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="text-base">{t("detail.effectivePermissions")}</CardTitle>
          <CardDescription>
            {[
              t("detail.effectivePermissionsCount", { count: permissions.length }),
              t("detail.applicationsCount", { n: access?.applications_count ?? 0 }),
              t("detail.policiesCount", { n: access?.policies_count ?? 0 }),
            ].join(" · ")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <DataState
            isLoading={permissionsLoading}
            isEmpty={permissions.length === 0}
            emptyIcon={LockIcon}
            emptyTitle={t("detail.noPermissions")}
            skeletonRows={4}
          >
            <div className="flex flex-wrap gap-1.5">
              {permissions.map((p) => (
                <span
                  key={p}
                  className="rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-xs"
                >
                  {p}
                </span>
              ))}
            </div>
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}
