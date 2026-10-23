import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
  TooltipProvider,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { Link } from "@tanstack/react-router";
import { BuildingComplexIcon, PlusIcon, RefreshCwIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ListToolbar, SortHeader } from "@/shared/components/data-table";
import { PageHeader } from "@/platform/components/page-header";
import { useCapabilities } from "@/platform/security/capability-provider";
import { type OrgActionHandlers, OrgRowActions } from "./org-row-actions";
import { OrgPreviewDrawer } from "./org-preview-drawer";
import { type OrgKpiFilter, OrgsKpis } from "./orgs-kpis";
import { initials } from "@/shared/utils/initials";
import { CreateOrgFlow } from "@/modules/onboarding";
import { useTenantId } from "@/platform/auth/session";
import { type CsvColumn, exportToCsv, exportToJson } from "@/shared/utils/data-export";
import { useListView } from "@/shared/hooks/use-list-view";
import { type Org, useOrgs } from "../api/orgs";
import { REGIONS } from "@/shared/data/regions";
import { useOrgActions } from "../use-org-actions";
import { EditOrgSheet } from "./edit-org-sheet";

const orgCsvColumns: CsvColumn<Org>[] = [
  { header: "id", value: (o) => o.id },
  { header: "name", value: (o) => o.name },
  { header: "slug", value: (o) => o.slug },
  { header: "plan", value: (o) => o.plan },
  { header: "region", value: (o) => o.region },
  { header: "status", value: (o) => o.status },
  { header: "member_count", value: (o) => String(o.member_count ?? "") },
  { header: "created_at", value: (o) => o.created_at },
];

/** Renders the organizations the caller belongs to, with KPIs, filters and the create and edit sheets. */
export function OrgsPage() {
  const { t } = useTranslation("organizations");
  const currentTenantId = useTenantId();
  const access = useCapabilities();
  const canWrite = access.can("tenant.write");
  const actions = useOrgActions();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Org | null>(null);
  const [previewOrg, setPreviewOrg] = useState<Org | null>(null);

  const listQ = useOrgs();
  const items = listQ.data?.items ?? [];

  const lv = useListView(items, {
    searchFields: (o) => [o.name, o.slug, o.region, o.id],
    filterFields: {
      status: (o) => o.status,
      plan: (o) => o.plan,
      region: (o) => o.region,
    },
    sortFields: {
      name: (o) => o.name,
      plan: (o) => o.plan,
      members: (o) => o.member_count ?? 0,
      created: (o) => o.created_at,
    },
  });
  const rows = lv.view;
  const denseCls = lv.density === "compact" ? "[&_td]:py-1.5 [&_th]:py-2" : undefined;

  const rowHandlers: OrgActionHandlers = {
    onEdit: setEditing,
    onToggleSuspend: actions.toggleSuspend,
    onDelete: (o) => actions.remove(o),
  };

  function handleKpiFilter(f: OrgKpiFilter) {
    lv.setSearch("");
    lv.setFilter("status", f === "all" ? "" : f);
  }

  const regionOptions = REGIONS.map((r) => ({ label: t(r.label), value: r.value }));

  return (
    <TooltipProvider>
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader
          description={t("tenants.description")}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => listQ.refetch()}
                disabled={listQ.isFetching}
              >
                <RefreshCwIcon className={listQ.isFetching ? "animate-spin" : ""} />
                {t("tenants.refresh")}
              </Button>
              <Button size="sm" onClick={() => setCreating(true)}>
                <PlusIcon /> {t("tenants.new")}
              </Button>
            </>
          }
        />

        <OrgsKpis orgs={items} loading={listQ.isLoading} onFilter={handleKpiFilter} />

        <Card>
          <CardContent className="p-0">
            <ListToolbar
              search={lv.search}
              onSearchChange={lv.setSearch}
              searchPlaceholder={t("tenants.list.searchPlaceholder")}
              filters={[
                {
                  id: "status",
                  label: t("tenants.filters.status.label"),
                  value: lv.filters.status ?? "",
                  options: [
                    { label: t("tenants.filters.status.active"), value: "active" },
                    { label: t("tenants.filters.status.suspended"), value: "suspended" },
                    { label: t("tenants.filters.status.deleted"), value: "deleted" },
                  ],
                  onChange: (v) => lv.setFilter("status", v),
                },
                {
                  id: "plan",
                  label: t("tenants.filters.plan.label"),
                  value: lv.filters.plan ?? "",
                  options: [
                    { label: t("tenants.filters.plan.free"), value: "free" },
                    { label: t("tenants.filters.plan.starter"), value: "starter" },
                    { label: t("tenants.filters.plan.pro"), value: "pro" },
                    { label: t("tenants.filters.plan.enterprise"), value: "enterprise" },
                  ],
                  onChange: (v) => lv.setFilter("plan", v),
                },
                {
                  id: "region",
                  label: t("tenants.columns.region"),
                  value: lv.filters.region ?? "",
                  options: regionOptions,
                  onChange: (v) => lv.setFilter("region", v),
                },
              ]}
              density={lv.density}
              onDensityChange={lv.setDensity}
              onExport={(fmt) =>
                fmt === "csv"
                  ? exportToCsv("organizations", rows, orgCsvColumns)
                  : exportToJson("organizations", rows)
              }
              exportDisabled={rows.length === 0}
              hasActiveFilters={lv.hasActiveFilters}
              onClear={lv.clear}
            />
            <DataState
              isLoading={listQ.isLoading}
              isError={listQ.isError}
              error={listQ.error}
              isEmpty={rows.length === 0}
              emptyIcon={BuildingComplexIcon}
              emptyTitle={
                lv.hasActiveFilters ? t("tenants.list.emptyFiltered") : t("tenants.list.empty")
              }
              skeletonRows={3}
            >
              <Table className={denseCls}>
                <TableHeader>
                  <TableRow>
                    <SortHeader columnKey="name" sort={lv.sort} onToggle={lv.toggleSort}>
                      {t("table.organization")}
                    </SortHeader>
                    <SortHeader columnKey="plan" sort={lv.sort} onToggle={lv.toggleSort}>
                      {t("tenants.columns.plan")}
                    </SortHeader>
                    <TableHead>{t("tenants.columns.region")}</TableHead>
                    <SortHeader columnKey="members" sort={lv.sort} onToggle={lv.toggleSort}>
                      {t("table.members")}
                    </SortHeader>
                    <TableHead>{t("tenants.columns.status")}</TableHead>
                    <SortHeader columnKey="created" sort={lv.sort} onToggle={lv.toggleSort}>
                      {t("tenants.columns.created")}
                    </SortHeader>
                    <TableHead className="w-10 text-right">
                      <span className="sr-only">{t("tenants.columns.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((org) => {
                    const isCurrent = org.id === currentTenantId;
                    return (
                      <TableRow
                        key={org.id}
                        onClick={() => setPreviewOrg(org)}
                        className="cursor-pointer transition-colors hover:bg-muted/40"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8 rounded-lg">
                              {org.logo_url ? (
                                <AvatarImage src={org.logo_url} alt={org.name} />
                              ) : null}
                              <AvatarFallback className="rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                                {initials(org.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Link
                                  to="/organizations/$orgId"
                                  params={{ orgId: org.id }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="truncate font-medium hover:underline"
                                >
                                  {org.name}
                                </Link>
                                {isCurrent && (
                                  <Badge variant="muted">{t("tenants.table.current")}</Badge>
                                )}
                              </div>
                              <div className="truncate font-mono text-xs text-muted-foreground">
                                {org.slug}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="muted" className="capitalize">
                            {org.plan}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{org.region || "—"}</TableCell>
                        <TableCell>
                          <div className="font-medium tabular-nums">{org.member_count ?? 0}</div>
                          <div className="text-xs text-muted-foreground">
                            {t("table.withMfa", { n: org.mfa_enabled_count ?? 0 })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusPill status={org.status} dot />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <TimeSince value={org.created_at} />
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <OrgRowActions
                            org={org}
                            isCurrent={isCurrent}
                            canWrite={canWrite}
                            handlers={rowHandlers}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="border-t px-4 py-3 text-sm text-muted-foreground">
                {t("tenants.list.count", {
                  shown: rows.length,
                  total: items.length,
                  count: items.length,
                })}
              </div>
            </DataState>
          </CardContent>
        </Card>

        <OrgPreviewDrawer
          org={previewOrg}
          isCurrent={previewOrg?.id === currentTenantId}
          onClose={() => setPreviewOrg(null)}
        />

        <CreateOrgSheet open={creating} onOpenChange={setCreating} />

        <EditOrgSheet org={editing} onOpenChange={(o) => !o && setEditing(null)} />
      </div>
    </TooltipProvider>
  );
}

type CreateOrgSheetProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

// Runs the same plan → name → pay flow as onboarding, so a paid organization is actually
// charged rather than just labelled.
function CreateOrgSheet({ open, onOpenChange }: CreateOrgSheetProps) {
  const { t } = useTranslation("organizations");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("tenants.create.title")}</SheetTitle>
          <SheetDescription>{t("tenants.create.description")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <CreateOrgFlow planStacked onCancel={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
