import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldGroup,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { useRouterState } from "@tanstack/react-router";
import { PlusIcon, RefreshCwIcon, ShieldCheckIcon } from "@qeetrix/icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { ListToolbar, SortHeader } from "@/shared/components/data-table";
import { PageHeader } from "@/platform/components/page-header";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { useRegisterContext } from "@/modules/qeetai";
import {
  type Permission,
  type Role,
  useCreateRole,
  useGrantPermission,
  usePermissions,
  useRevokePermission,
  useRolePermissions,
  useRoles,
} from "../api/rbac";
import { type CsvColumn, exportToCsv, exportToJson } from "@/shared/utils/data-export";
import { useListView } from "@/shared/hooks/use-list-view";

const roleCsvColumns: CsvColumn<Role>[] = [
  { header: "id", value: (r) => r.id },
  { header: "name", value: (r) => r.name },
  { header: "description", value: (r) => r.description },
  { header: "type", value: (r) => (r.is_system ? "system" : "custom") },
  { header: "created_at", value: (r) => r.created_at },
];

/** Renders the organization's roles, with create and permission grants. */
export function RolesPage() {
  const { t } = useTranslation("rbac");
  const rolesQ = useRoles();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);

  // Tells Qeet AI which role is on screen, so suggestions such as "Grant permission to this
  // role" are prefilled.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qeetaiCtx = useMemo(
    () =>
      editing ? { selection: { kind: "role" as const, id: editing.id, label: editing.name } } : {},
    [editing],
  );
  useRegisterContext(pathname, qeetaiCtx);

  const items = rolesQ.data?.items ?? [];
  const lv = useListView(items, {
    searchFields: (r) => [r.name, r.description],
    filterFields: { type: (r) => (r.is_system ? "system" : "custom") },
    sortFields: { name: (r) => r.name, created: (r) => r.created_at },
  });
  const rows = lv.view;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        description={t("rolesPage.createRolesAndManage")}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => rolesQ.refetch()}
              disabled={rolesQ.isFetching}
            >
              <RefreshCwIcon className={rolesQ.isFetching ? "animate-spin" : ""} />{" "}
              {t("roles.refreshBtn")}
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <PlusIcon /> {t("roles.newButton")}
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("rolesPage.roles")}</CardTitle>
          <CardDescription>
            {t("roles.list.count", {
              count: items.length,
              filtered: rows.length,
              total: items.length,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ListToolbar
            search={lv.search}
            onSearchChange={lv.setSearch}
            searchPlaceholder={t("roles.list.searchPlaceholder")}
            filters={[
              {
                id: "type",
                label: t("common:labels.type"),
                value: lv.filters.type ?? "",
                options: [
                  { label: t("rolesPage.system"), value: "system" },
                  { label: t("rolesPage.custom"), value: "custom" },
                ],
                onChange: (v) => lv.setFilter("type", v),
              },
            ]}
            columns={[{ id: "created", label: t("common:labels.created") }]}
            isColumnVisible={lv.isVisible}
            onToggleColumn={lv.toggleColumn}
            density={lv.density}
            onDensityChange={lv.setDensity}
            onExport={(fmt) =>
              fmt === "csv"
                ? exportToCsv("roles", rows, roleCsvColumns)
                : exportToJson("roles", rows)
            }
            exportDisabled={rows.length === 0}
            hasActiveFilters={lv.hasActiveFilters}
            onClear={lv.clear}
          />
          <DataState
            isLoading={rolesQ.isLoading}
            isError={rolesQ.isError}
            error={rolesQ.error}
            isEmpty={rows.length === 0}
            emptyIcon={ShieldCheckIcon}
            emptyTitle={lv.hasActiveFilters ? t("roles.list.emptyFiltered") : t("roles.list.empty")}
            skeletonRows={3}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader columnKey="name" sort={lv.sort} onToggle={lv.toggleSort}>
                    {t("common:labels.name")}
                  </SortHeader>
                  <TableHead>{t("rolesPage.description")}</TableHead>
                  <TableHead>{t("common:labels.type")}</TableHead>
                  {lv.isVisible("created") && (
                    <SortHeader columnKey="created" sort={lv.sort} onToggle={lv.toggleSort}>
                      {t("common:labels.created")}
                    </SortHeader>
                  )}
                  <TableHead className="text-right">{t("common:labels.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.is_system ? "muted" : "outline"}>
                        {r.is_system ? t("rolesPage.system") : t("rolesPage.custom")}
                      </Badge>
                    </TableCell>
                    {lv.isVisible("created") && (
                      <TableCell>
                        <TimeSince value={r.created_at} />
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
                        {t("rolesPage.permissions")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      <CreateRoleSheet open={creating} onOpenChange={setCreating} />
      {editing && <RolePermissionsSheet role={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** Renders the sheet that creates an empty custom role; permissions are granted afterwards. */
function CreateRoleSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {open && <CreateRoleForm onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

const ROLE_NAME_MAX = 64;
const ROLE_DESCRIPTION_MAX = 500;

function CreateRoleForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation("rbac");
  const createM = useCreateRole();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("roles.create.validation.name")).max(ROLE_NAME_MAX),
        description: z.string().max(ROLE_DESCRIPTION_MAX),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { name: "", description: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await createM
        .mutateAsync({ name: value.name.trim(), description: value.description.trim() })
        .then(onDone)
        .catch((err: unknown) => applyServerErrors(formApi, err));
    },
  });

  return (
    <form
      className="flex h-full flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <SheetHeader>
        <SheetTitle>{t("roles.create.title")}</SheetTitle>
        <SheetDescription>{t("roles.create.description")}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                label={t("roles.create.nameLabel")}
                placeholder="editor"
                maxLength={ROLE_NAME_MAX}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="description">
            {(field) => (
              <field.TextareaField
                label={t("roles.create.descLabel")}
                rows={3}
                maxLength={ROLE_DESCRIPTION_MAX}
              />
            )}
          </form.AppField>
          <FormError error={createM.error} />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("roles.create.cancelBtn")}
        </SheetClose>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("roles.create.creatingBtn")}>
            {t("roles.create.createBtn")}
          </form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}

function RolePermissionsSheet({ role, onClose }: { role: Role; onClose: () => void }) {
  const { t } = useTranslation("rbac");
  const permsQ = useRolePermissions(role.id);
  const grantM = useGrantPermission(role.id);
  const revokeM = useRevokePermission(role.id);
  const runSensitive = useSensitiveAction();
  const granted = new Set((permsQ.data?.items ?? []).map((p: Permission) => p.id));

  // A toggle is its own confirmation and is undone by toggling back, so neither direction asks
  // first; both are step-up gated.
  const grant = (permId: string) =>
    runSensitive({
      actionLabel: t("roles.permsSheet.grantAction").toLowerCase(),
      run: () => grantM.mutateAsync(permId),
    }).catch(settleSensitiveAction);
  const revoke = (permId: string) =>
    runSensitive({
      actionLabel: t("roles.permsSheet.revokeAction").toLowerCase(),
      run: () => revokeM.mutateAsync(permId),
    }).catch(settleSensitiveAction);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t("roles.permsSheet.title", { name: role.name })}</SheetTitle>
          <SheetDescription>{t("rolesPage.toggleAPermissionTo")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <DataState
            isLoading={permsQ.isLoading}
            isError={permsQ.isError}
            error={permsQ.error}
            isEmpty={false}
            skeletonRows={4}
          >
            <PermissionToggleList
              grantedIds={granted}
              busy={grantM.isPending || revokeM.isPending}
              onGrant={grant}
              onRevoke={revoke}
              currentPermissions={permsQ.data?.items ?? []}
            />
          </DataState>
        </div>
        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button variant="outline" onClick={onClose}>
            {t("rolesPage.done")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function PermissionToggleList({
  grantedIds,
  busy,
  onGrant,
  onRevoke,
  currentPermissions,
}: {
  grantedIds: Set<string>;
  busy: boolean;
  onGrant: (id: string) => void;
  onRevoke: (id: string) => void;
  currentPermissions: Permission[];
}) {
  const { t } = useTranslation("rbac");
  const catalogue = usePermissionsCatalogue(); // to offer permissions not yet granted
  const merged = mergeCatalogue(catalogue, currentPermissions);
  return (
    <ul className="flex flex-col gap-2">
      {merged.map((p) => {
        const isGranted = grantedIds.has(p.id);
        return (
          <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
            <span className="min-w-0">
              <code className="text-xs font-medium">{p.key}</code>
              <p className="truncate text-xs text-muted-foreground">{p.description}</p>
            </span>
            <Switch
              checked={isGranted}
              disabled={busy}
              aria-label={
                isGranted
                  ? t("rolesPage.revokeKey", { key: p.key })
                  : t("rolesPage.grantKey", { key: p.key })
              }
              onCheckedChange={(checked) => (checked ? onGrant(p.id) : onRevoke(p.id))}
            />
          </li>
        );
      })}
    </ul>
  );
}

// Reads the cached permissions catalogue, to avoid prop-drilling it.
function usePermissionsCatalogue(): Permission[] {
  const q = usePermissions();
  return q.data?.items ?? [];
}

function mergeCatalogue(catalogue: Permission[], current: Permission[]): Permission[] {
  const byId = new Map<string, Permission>();
  for (const p of catalogue) byId.set(p.id, p);
  for (const p of current) byId.set(p.id, p);
  return [...byId.values()].sort((a, b) => a.key.localeCompare(b.key));
}
