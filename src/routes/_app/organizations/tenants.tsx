import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  DataState,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2Icon, Loader2Icon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useConfirmDialog } from "@/shared/components/confirm-dialog";
import { ListToolbar, SortHeader } from "@/shared/components/data-table";
import { LogoField } from "@/shared/components/logo-field";
import { PageHeader } from "@/platform/components/page-header";
import { useCapabilities } from "@/platform/security/capability-provider";
import { type OrgActionHandlers, OrgRowActions } from "@/modules/organizations/org-row-actions";
import { OrgPreviewDrawer } from "@/modules/organizations/org-preview-drawer";
import { type OrgKpiFilter, OrgsKpis } from "@/modules/organizations/orgs-kpis";
import { initials } from "@/modules/users/helpers";
import { CreateOrgFlow } from "@/modules/onboarding/create-org-flow";
import { type ApiError, api, tokenStore } from "@/platform/api/client";
import { type CsvColumn, exportToCsv, exportToJson } from "@/shared/utils/export";
import { useListView } from "@/shared/hooks/use-list-view";
import { type Org, useDeleteOrg, useOrgs, useUpdateOrg } from "@/modules/organizations/api/orgs";
import { REGIONS } from "@/shared/data/regions";

export const Route = createFileRoute("/_app/organizations/tenants")({
  component: TenantsPage,
});

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

function TenantsPage() {
  const { t } = useTranslation("organizations");
  const qc = useQueryClient();
  const currentTenantId = tokenStore.getTenantId();
  const access = useCapabilities();
  const canWrite = access.can("tenant.write");
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Org | null>(null);
  const [previewOrg, setPreviewOrg] = useState<Org | null>(null);

  const listQ = useOrgs();
  const items = listQ.data?.items ?? [];
  const updateOrg = useUpdateOrg();
  const deleteOrg = useDeleteOrg();

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
    onToggleSuspend: (o) => {
      if (o.status === "suspended") {
        updateOrg.mutate({ id: o.id, body: { status: "active" } });
        return;
      }
      openConfirm({
        title: t("suspend.title"),
        description: t("suspend.description", { name: o.name }),
        variant: "destructive",
        confirmLabel: t("rowActions.suspend"),
        onConfirm: () => updateOrg.mutate({ id: o.id, body: { status: "suspended" } }),
      });
    },
    onDelete: (o) =>
      openConfirm({
        title: t("tenants.delete.title"),
        description: t("delete.description", { name: o.name, slug: o.slug }),
        variant: "destructive",
        confirmLabel: t("tenants.delete.delete"),
        onConfirm: () => deleteOrg.mutate(o.id),
      }),
  };

  function handleKpiFilter(f: OrgKpiFilter) {
    lv.setSearch("");
    lv.setFilter("status", f === "all" ? "" : f);
  }

  const regionOptions = REGIONS.map((r) => ({ label: r.label, value: r.value }));

  return (
    <TooltipProvider>
      <div className="flex min-w-0 flex-col gap-4">
        {confirmDialog}
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
              emptyIcon={Building2Icon}
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

        <CreateTenantSheet
          open={creating}
          onOpenChange={setCreating}
          onCreated={() => qc.invalidateQueries({ queryKey: ["tenants"] })}
        />

        <EditTenantSheet
          tenant={editing}
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["tenants"] });
          }}
        />
      </div>
    </TooltipProvider>
  );
}

type CreateTenantSheetProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
};

// Creating an additional organization runs the same plan → name → pay flow as
// first-run onboarding (CreateOrgFlow), so a paid org actually charges through
// Razorpay instead of just setting a plan label.
function CreateTenantSheet({ open, onOpenChange }: CreateTenantSheetProps) {
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

type EditTenantSheetProps = {
  tenant: Org | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
};

type UpdateBody = {
  name?: string;
  status?: "active" | "suspended";
  region?: string;
  logo_url?: string;
};

function EditTenantSheet({ tenant, onOpenChange, onSaved }: EditTenantSheetProps) {
  const { t } = useTranslation("organizations");
  const [status, setStatus] = useState<string>(
    tenant?.status === "suspended" ? "suspended" : "active",
  );
  const [region, setRegion] = useState<string>(tenant?.region ?? "");
  const [logo, setLogo] = useState<string>(tenant?.logo_url ?? "");

  const lastId = useState<string | null>(null);
  if (tenant && tenant.id !== lastId[0]) {
    lastId[1](tenant.id);
    setStatus(tenant.status === "suspended" ? "suspended" : "active");
    setRegion(tenant.region ?? "");
    setLogo(tenant.logo_url ?? "");
  }

  const updateM = useMutation({
    mutationFn: (body: UpdateBody) =>
      api<Org>(`/v1/tenants/${tenant!.id}`, { method: "PATCH", body }),
    onSuccess: onSaved,
    meta: { successMessage: "Tenant updated" },
  });

  return (
    <Sheet open={!!tenant} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {tenant && (
          <form
            className="flex h-full flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              updateM.mutate({
                name: String(data.get("name") ?? "").trim(),
                region,
                status: status as UpdateBody["status"],
                logo_url: logo,
              });
            }}
          >
            <SheetHeader>
              <SheetTitle>{t("tenants.edit.title")}</SheetTitle>
              <SheetDescription>{t("tenants.edit.description")}</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="edit-name">{t("tenants.edit.name")}</FieldLabel>
                  <Input
                    id="edit-name"
                    name="name"
                    defaultValue={tenant.name}
                    required
                    minLength={1}
                    maxLength={200}
                  />
                </Field>
                <Field>
                  <FieldLabel>Logo</FieldLabel>
                  <LogoField
                    value={logo}
                    onChange={setLogo}
                    hint="Shown across the console. Leave empty to use an initials avatar."
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-slug">{t("tenants.edit.slug")}</FieldLabel>
                  <Input id="edit-slug" value={tenant.slug} readOnly disabled />
                  <FieldDescription>{t("tenants.edit.slugHelp")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>{t("tenants.edit.plan")}</FieldLabel>
                  <Input
                    value={(tenant.plan ?? "free").replace(/^./, (c) => c.toUpperCase())}
                    readOnly
                    disabled
                  />
                  <FieldDescription>Plan changes are made through billing.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>{t("tenants.edit.status")}</FieldLabel>
                  <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t("tenants.edit.statusActive")}</SelectItem>
                      <SelectItem value="suspended">{t("tenants.edit.statusSuspended")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>{t("tenants.edit.statusHelp")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-region">{t("tenants.edit.region")}</FieldLabel>
                  <Select value={region} onValueChange={(v) => v && setRegion(v)}>
                    <SelectTrigger id="edit-region">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {updateM.error && (
                  <Field>
                    <FieldError>{(updateM.error as ApiError).message}</FieldError>
                  </Field>
                )}
              </FieldGroup>
            </div>
            <SheetFooter className="flex-row justify-end gap-2 border-t">
              <SheetClose render={<Button type="button" variant="outline" />}>
                {t("tenants.edit.cancel")}
              </SheetClose>
              <Button type="submit" disabled={updateM.isPending}>
                {updateM.isPending && <Loader2Icon className="animate-spin" />}
                {updateM.isPending ? t("tenants.edit.saving") : t("tenants.edit.save")}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
