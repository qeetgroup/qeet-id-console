import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { Link } from "@tanstack/react-router";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CloudUploadIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserIcon,
} from "@qeetrix/icons";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useRoles } from "@/modules/authorization";
import { useTenantId, useUserId } from "@/platform/auth/session";
import { DataState } from "@/platform/components/data-state";
import { PageHeader } from "@/platform/components/page-header";
import { useCapabilities } from "@/platform/security/capability-provider";
import { ReadOnlyNotice } from "@/platform/security/read-only-notice";
import {
  BulkBar,
  ListToolbar,
  MasterCheckbox,
  RowCheckbox,
  SortHeader,
} from "@/shared/components/data-table";
import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import { useListView } from "@/shared/hooks/use-list-view";
import { type CsvColumn, exportToCsv, exportToJson } from "@/shared/utils/data-export";
import { initials } from "@/shared/utils/initials";

import { type User, useUserStats, useUserTrends, useUsers } from "../api/users";
import { useUserActions } from "../use-user-actions";
import { primaryRole } from "../user-display";
import { BulkActions } from "./bulk-actions";
import { CreateUserSheet } from "./create-user-sheet";
import { EditUserSheet } from "./edit-user-sheet";
import { MoreFilters, SaveView } from "./filter-extras";
import { SetPasswordSheet } from "./set-password-sheet";
import { UserPreviewDrawer } from "./user-preview-drawer";
import { type RowActionHandlers, UserRowActions } from "./user-row-actions";
import { type KpiFilter, UsersKpis } from "./users-kpis";

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

const PAGE_SIZES = [25, 50, 100];

/** Renders the users list: KPIs, filters, bulk actions, paging and the create and edit sheets. */
export function UsersPage() {
  const { t } = useTranslation("users");
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

  const total = statsQ.data?.total;
  const totalPages = total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : undefined;
  const rangeStart = items.length ? page * pageSize + 1 : 0;
  const rangeEnd = page * pageSize + items.length;
  const hasPrev = page > 0;
  const hasNext = totalPages !== undefined ? page + 1 < totalPages : items.length === pageSize;

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
              <Table className={denseCls}>
                <TableHeader>
                  <TableRow>
                    {canWriteUsers ? (
                      <TableHead className="w-8">
                        <MasterCheckbox
                          selectableIds={selectableIds}
                          selectedIds={selectedIds}
                          onChange={setSelectedIds}
                          label={t("list.selectAll")}
                        />
                      </TableHead>
                    ) : null}
                    <SortHeader columnKey="name" sort={lv.sort} onToggle={lv.toggleSort}>
                      {t("table.user")}
                    </SortHeader>
                    <TableHead>{t("table.access")}</TableHead>
                    <SortHeader columnKey="status" sort={lv.sort} onToggle={lv.toggleSort}>
                      {t("table.status")}
                    </SortHeader>
                    <TableHead>{t("table.security")}</TableHead>
                    <SortHeader columnKey="lastSeen" sort={lv.sort} onToggle={lv.toggleSort}>
                      {t("table.lastSeen")}
                    </SortHeader>
                    <SortHeader columnKey="created" sort={lv.sort} onToggle={lv.toggleSort}>
                      {t("table.created")}
                    </SortHeader>
                    <TableHead className="w-10 text-right">
                      <span className="sr-only">{t("table.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u) => {
                    const isSelf = u.id === currentUserId;
                    const isSelected = selectedIds.has(u.id);
                    const name = u.display_name || u.email;
                    const role = primaryRole(u.roles);
                    return (
                      <TableRow
                        key={u.id}
                        onClick={() => setPreviewUser(u)}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/40",
                          isSelected && "bg-muted/40",
                        )}
                      >
                        {canWriteUsers ? (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <RowCheckbox
                              id={u.id}
                              checked={isSelected}
                              disabled={isSelf}
                              label={t("list.selectOne", { email: u.email })}
                              onChange={(id, checked) =>
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (checked) next.add(id);
                                  else next.delete(id);
                                  return next;
                                })
                              }
                            />
                          </TableCell>
                        ) : null}

                        {/* USER — identity first */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8 rounded-lg">
                              <AvatarFallback className="rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                                {initials(name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Link
                                  to="/users/$userId"
                                  params={{ userId: u.id }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="truncate font-medium hover:underline"
                                >
                                  {name}
                                </Link>
                                {isSelf && <Badge variant="muted">{t("list.you")}</Badge>}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* ACCESS */}
                        <TableCell>
                          {role ? (
                            <div className="min-w-0">
                              <div className="font-medium capitalize">{role}</div>
                              <div className="text-xs text-muted-foreground">
                                {t("access.rolesGroups", {
                                  roles: u.roles?.length ?? 0,
                                  groups: u.groups_count ?? 0,
                                })}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">{t("access.noAccess")}</span>
                          )}
                        </TableCell>

                        {/* STATUS */}
                        <TableCell>
                          <StatusPill status={u.status} dot />
                        </TableCell>

                        {/* SECURITY */}
                        <TableCell>
                          <SecurityCell user={u} />
                        </TableCell>

                        {/* LAST SEEN */}
                        <TableCell className="text-sm text-muted-foreground">
                          {u.last_seen_at ? (
                            <TimeSince value={u.last_seen_at} />
                          ) : (
                            <span>{t("preview.never")}</span>
                          )}
                        </TableCell>

                        {/* CREATED */}
                        <TableCell className="text-sm text-muted-foreground">
                          <TimeSince value={u.created_at} />
                        </TableCell>

                        {/* ACTIONS */}
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <UserRowActions
                            user={u}
                            canWrite={canWriteUsers}
                            isSelf={isSelf}
                            handlers={rowHandlers}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Three tracks keep the page controls centred on the table however wide the range
                  label or size select gets; one column below sm. */}
              <div className="grid grid-cols-1 items-center gap-3 border-t px-4 py-3 sm:grid-cols-[1fr_auto_1fr]">
                <span className="text-sm text-muted-foreground">
                  {total !== undefined
                    ? t("pagination.showing", {
                        start: rangeStart,
                        end: rangeEnd,
                        total: total.toLocaleString(),
                      })
                    : t("pagination.showingSimple", { start: rangeStart, end: rangeEnd })}
                </span>
                <div className="flex items-center justify-center gap-1 sm:order-2">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={!hasPrev || usersQ.isFetching}
                    aria-label={t("pagination.prev")}
                    onClick={() => goToPage(page - 1)}
                  >
                    <ChevronLeftIcon className="size-4" />
                  </Button>
                  {totalPages !== undefined
                    ? pageWindow(page + 1, totalPages).map((p, i) =>
                        p === "…" ? (
                          <span
                            // biome-ignore lint/suspicious/noArrayIndexKey: positional markers
                            key={`ellipsis-${i}`}
                            className="px-1.5 text-sm text-muted-foreground"
                          >
                            …
                          </span>
                        ) : (
                          <Button
                            key={p}
                            variant={p === page + 1 ? "default" : "outline"}
                            size="icon"
                            className="min-w-9"
                            disabled={usersQ.isFetching}
                            onClick={() => goToPage(p - 1)}
                          >
                            {p}
                          </Button>
                        ),
                      )
                    : null}
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={!hasNext || usersQ.isFetching}
                    aria-label={t("pagination.next")}
                    onClick={() => goToPage(page + 1)}
                  >
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 sm:order-3 sm:justify-self-end">
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => v && changePageSize(Number(v))}
                  >
                    <SelectTrigger className="w-32" aria-label={t("pagination.pageSize")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {t("pagination.perPage", { n })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
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

// Numbered-pager window: 1 … (n-1) n (n+1) … N, collapsing far pages to "…".
function pageWindow(current: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  if (current > 4) out.push("…");
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  for (let i = start; i <= end; i++) out.push(i);
  if (current < totalPages - 3) out.push("…");
  out.push(totalPages);
  return out;
}

function SecurityCell({ user }: { user: User }) {
  const { t } = useTranslation("users");
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <span className="inline-flex items-center gap-1">
        {user.email_verified_at ? (
          <CircleCheckIcon className="size-3.5 text-success" aria-hidden="true" />
        ) : (
          <ShieldAlertIcon className="size-3.5 text-warning" aria-hidden="true" />
        )}
        {t("security.email")}
      </span>
      <span className="inline-flex items-center gap-1">
        {user.mfa_enabled ? (
          <ShieldCheckIcon className="size-3.5 text-success" aria-hidden="true" />
        ) : (
          <ShieldAlertIcon className="size-3.5 text-warning" aria-hidden="true" />
        )}
        {user.mfa_enabled ? t("security.mfaOn") : t("security.mfaOff")}
      </span>
    </div>
  );
}
