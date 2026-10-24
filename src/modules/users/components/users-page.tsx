import { Button, buttonVariants, Card, CardContent, TooltipProvider } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { CloudUploadIcon, PlusIcon, RefreshCwIcon, UserIcon } from "@qeetrix/icons";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useRoles } from "@/modules/authorization";
import { useTenantId, useUserId } from "@/platform/auth/session";
import { DataState } from "@/platform/components/data-state";
import { PageHeader } from "@/platform/components/page-header";
import { useCapabilities } from "@/platform/security/capability-provider";
import { ReadOnlyNotice } from "@/platform/security/read-only-notice";
import { BulkBar, ListToolbar } from "@/shared/components/data-table";
import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import { useListView } from "@/shared/hooks/use-list-view";
import { type CsvColumn, exportToCsv, exportToJson } from "@/shared/utils/data-export";

import { type User, useUserStats, useUserTrends, useUsers } from "../api/users";
import { useUserActions } from "../use-user-actions";
import { BulkActions } from "./bulk-actions";
import { CreateUserSheet } from "./create-user-sheet";
import { EditUserSheet } from "./edit-user-sheet";
import { MoreFilters, SaveView } from "./filter-extras";
import { SetPasswordSheet } from "./set-password-sheet";
import { UserPreviewDrawer } from "./user-preview-drawer";
import type { RowActionHandlers } from "./user-row-actions";
import { type KpiFilter, UsersKpis } from "./users-kpis";
import { UsersPagination } from "./users-page-pagination";
import { UsersTable } from "./users-page-table";

const userCsvColumns: CsvColumn<User>[] = [
  { header: "id", value: (u) => u.id },
  { header: "email", value: (u) => u.email },
  { header: "display_name", value: (u) => u.display_name },
  { header: "phone", value: (u) => u.phone },
  { header: "status", value: (u) => u.status },
  { header: "roles", value: (u) => (u.roles ?? []).join("|") },
  { header: "mfa_enabled", value: (u) => String(u.mfa_enabled ?? "") },
  { header: "last_seen_at", value: (u) => u.last_seen_at },
  { header: "created_at", value: (u) => u.created_at },
];

/** Renders the users list: KPIs, filters, bulk actions, paging and the create and edit sheets. */
export function UsersPage() {
  const { t } = useTranslation(["users", "common"]);
  const access = useCapabilities();
  const canWriteUsers = access.can("user.write");
  const canCreateUsers = access.canAll(["user.write", "role.read", "role.write"]);
  const tenantId = useTenantId();
  const currentUserId = useUserId();
  const rolesQ = useRoles();
  const actions = useUserActions();

  const [creating, setCreating] = useCreateIntent(canCreateUsers);
  const [editing, setEditing] = useState<User | null>(null);
  const [settingPassword, setSettingPassword] = useState<User | null>(null);
  const [previewUser, setPreviewUser] = useState<User | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [roleFilter, setRoleFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0); // offset paging, so the console can jump to any page

  const usersQ = useUsers({ limit: pageSize, offset: page * pageSize });
  const statsQ = useUserStats();
  const trendsQ = useUserTrends();

  const items = usersQ.data?.items ?? [];

  // Role is an array per user, which useListView's equality filter can't express,
  // so pre-filter by role membership before the client search/sort/facets run.
  const preFiltered = useMemo(() => {
    let list = items;
    if (roleFilter) list = list.filter((u) => (u.roles ?? []).includes(roleFilter));
    if (emailFilter === "verified") list = list.filter((u) => !!u.email_verified_at);
    else if (emailFilter === "unverified") list = list.filter((u) => !u.email_verified_at);
    return list;
  }, [items, roleFilter, emailFilter]);

  const lv = useListView(preFiltered, {
    searchFields: (u) => [u.email, u.display_name, u.phone, u.id],
    filterFields: {
      status: (u) => u.status,
      mfa: (u) => (u.mfa_enabled ? "enabled" : "disabled"),
    },
    sortFields: {
      name: (u) => u.display_name ?? u.email,
      status: (u) => u.status,
      lastSeen: (u) => u.last_seen_at ?? "",
      created: (u) => u.created_at,
    },
  });
  const rows = lv.view;
  const selectableIds = canWriteUsers
    ? rows.filter((u) => u.id !== currentUserId).map((u) => u.id)
    : [];
  const selectedUsers = items.filter((u) => selectedIds.has(u.id));

  useEffect(() => {
    if (!canWriteUsers) {
      setEditing(null);
      setSettingPassword(null);
      setSelectedIds(new Set());
    }
    if (!canCreateUsers) setCreating(false);
    // setCreating is a useState setter, so it is stable and never re-triggers this.
  }, [canCreateUsers, canWriteUsers, setCreating]);

  // Deleting the last users of a later page empties it, which would read as "no users yet"
  // with no pager to leave by, so step back a page.
  const pageEmptied = page > 0 && usersQ.isSuccess && !usersQ.isFetching && items.length === 0;
  useEffect(() => {
    if (pageEmptied) setPage((p) => Math.max(0, p - 1));
  }, [pageEmptied]);

  const rowHandlers: RowActionHandlers = {
    onEdit: setEditing,
    onSetPassword: setSettingPassword,
    onResetMfa: actions.resetMfa,
    onRevokeSessions: actions.revokeSessions,
    onToggleSuspend: (u) => (u.status === "suspended" ? actions.reactivate(u) : actions.suspend(u)),
    onDelete: (u) => actions.remove(u),
  };

  const statusOptions = [
    { label: t("status.active"), value: "active" },
    { label: t("status.invited"), value: "invited" },
    { label: t("status.suspended"), value: "suspended" },
    { label: t("status.deleted"), value: "deleted" },
  ];
  const roleOptions = (rolesQ.data?.items ?? []).map((r) => ({ label: r.name, value: r.name }));
  const mfaOptions = [
    { label: t("security.mfaOn"), value: "enabled" },
    { label: t("security.mfaOff"), value: "disabled" },
  ];

  const hasActiveFilters = lv.hasActiveFilters || roleFilter !== "" || emailFilter !== "";
  const denseCls = lv.density === "compact" ? "[&_td]:py-1.5 [&_th]:py-2" : undefined;

  function goToPage(next: number) {
    setPage(Math.max(0, next));
    setSelectedIds(new Set());
  }
  function changePageSize(next: number) {
    setPageSize(next);
    setPage(0);
    setSelectedIds(new Set());
  }
  // A KPI card filters the current page client-side, as the facets do.
  function handleKpiFilter(f: KpiFilter) {
    setPage(0);
    setRoleFilter("");
    lv.setSearch("");
    if (f === "all") {
      lv.setFilter("status", "");
      lv.setFilter("mfa", "");
    } else if (f === "active") {
      lv.setFilter("mfa", "");
      lv.setFilter("status", "active");
    } else if (f === "suspended") {
      lv.setFilter("mfa", "");
      lv.setFilter("status", "suspended");
    } else if (f === "mfa_enabled") {
      lv.setFilter("status", "");
      lv.setFilter("mfa", "enabled");
    } else if (f === "mfa_missing") {
      lv.setFilter("status", "");
      lv.setFilter("mfa", "disabled");
    }
  }

  return (
    <TooltipProvider>
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader
          description={t("list.description")}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  usersQ.refetch();
                  statsQ.refetch();
                }}
                disabled={usersQ.isFetching}
              >
                <RefreshCwIcon className={usersQ.isFetching ? "animate-spin" : ""} />
                {t("common:actions.refresh")}
              </Button>
              {canWriteUsers ? (
                <Link
                  to="/users/import"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <CloudUploadIcon /> {t("list.import")}
                </Link>
              ) : null}
              {canCreateUsers ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <PlusIcon /> {t("list.newUser")}
                </Button>
              ) : null}
            </>
          }
        />

        <UsersKpis
          stats={statsQ.data}
          trends={trendsQ.data}
          loading={statsQ.isLoading}
          onFilter={handleKpiFilter}
        />

        {!canWriteUsers ? <ReadOnlyNotice /> : null}

        <Card>
          <CardContent className="p-0">
            <ListToolbar
              search={lv.search}
              onSearchChange={lv.setSearch}
              searchPlaceholder={t("list.searchPlaceholder")}
              filters={[
                {
                  id: "status",
                  label: t("table.status"),
                  value: lv.filters.status ?? "",
                  options: statusOptions,
                  onChange: (v) => lv.setFilter("status", v),
                },
                {
                  id: "role",
                  label: t("table.role"),
                  value: roleFilter,
                  options: roleOptions,
                  onChange: setRoleFilter,
                },
                {
                  id: "mfa",
                  label: t("filters.mfa"),
                  value: lv.filters.mfa ?? "",
                  options: mfaOptions,
                  onChange: (v) => lv.setFilter("mfa", v),
                },
              ]}
              density={lv.density}
              onDensityChange={lv.setDensity}
              onExport={(fmt) =>
                fmt === "csv"
                  ? exportToCsv("users", rows, userCsvColumns)
                  : exportToJson("users", rows)
              }
              exportDisabled={rows.length === 0}
              hasActiveFilters={hasActiveFilters}
              onClear={() => {
                lv.clear();
                setRoleFilter("");
                setEmailFilter("");
              }}
            >
              <MoreFilters
                emailVerified={emailFilter}
                onEmailVerified={(v) => {
                  setEmailFilter(v);
                  setPage(0);
                }}
                activeCount={emailFilter ? 1 : 0}
              />
              <SaveView
                current={{
                  search: lv.search,
                  status: lv.filters.status ?? "",
                  role: roleFilter,
                  mfa: lv.filters.mfa ?? "",
                  emailVerified: emailFilter,
                }}
                onApply={(v) => {
                  lv.setSearch(v.search);
                  lv.setFilter("status", v.status);
                  lv.setFilter("mfa", v.mfa);
                  setRoleFilter(v.role);
                  setEmailFilter(v.emailVerified);
                  setPage(0);
                }}
              />
            </ListToolbar>

            {canWriteUsers && selectedIds.size > 0 && (
              <BulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
                <BulkActions
                  selectedUsers={selectedUsers}
                  onDone={() => setSelectedIds(new Set())}
                />
              </BulkBar>
            )}

            <DataState
              isLoading={usersQ.isLoading}
              isError={usersQ.isError}
              error={usersQ.error}
              isEmpty={rows.length === 0}
              emptyIcon={UserIcon}
              emptyTitle={hasActiveFilters ? t("list.emptyTitleFiltered") : t("list.emptyTitle")}
              emptyDescription={
                hasActiveFilters ? t("list.emptyDescriptionFiltered") : t("list.emptyDescription")
              }
            >
              <UsersTable
                rows={rows}
                currentUserId={currentUserId}
                canWrite={canWriteUsers}
                selectableIds={selectableIds}
                selectedIds={selectedIds}
                onSelectedIdsChange={setSelectedIds}
                sort={lv.sort}
                onToggleSort={lv.toggleSort}
                onPreview={setPreviewUser}
                handlers={rowHandlers}
                className={denseCls}
              />
              <UsersPagination
                page={page}
                pageSize={pageSize}
                itemCount={items.length}
                total={statsQ.data?.total}
                fetching={usersQ.isFetching}
                onPageChange={goToPage}
                onPageSizeChange={changePageSize}
              />
            </DataState>
          </CardContent>
        </Card>

        <UserPreviewDrawer user={previewUser} onClose={() => setPreviewUser(null)} />

        {canCreateUsers ? (
          <CreateUserSheet open={creating} onOpenChange={setCreating} tenantId={tenantId} />
        ) : null}

        {canWriteUsers ? (
          <>
            <EditUserSheet
              user={editing}
              isSelf={!!editing && editing.id === currentUserId}
              onOpenChange={(o) => !o && setEditing(null)}
            />

            <SetPasswordSheet
              user={settingPassword}
              onOpenChange={(o) => !o && setSettingPassword(null)}
            />
          </>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
