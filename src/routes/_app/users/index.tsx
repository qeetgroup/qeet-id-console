import {
  Add,
  ArrowLeftAlt,
  ArrowRightAlt,
  CloudAdd,
  RefreshArrow,
  ShieldSecurity,
  ShieldTick,
  TickCircle,
  User as UserIcon,
} from "@qeetrix/icons";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  cn,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/platform/errors/user-message";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useConfirmDialog } from "@/shared/components/confirm-dialog";
import {
  BulkBar,
  ListToolbar,
  MasterCheckbox,
  RowCheckbox,
  SortHeader,
} from "@/shared/components/data-table";
import { PageHeader } from "@/platform/components/page-header";
import { useCapabilities } from "@/platform/security/capability-provider";
import { ReadOnlyNotice } from "@/platform/security/read-only-notice";
import { BulkActions } from "@/modules/users/bulk-actions";
import { MoreFilters, SaveView } from "@/modules/users/filter-extras";
import { primaryRole } from "@/modules/users/user-display";
import { initials } from "@/shared/utils/initials";
import { UserPreviewDrawer } from "@/modules/users/user-preview-drawer";
import { type RowActionHandlers, UserRowActions } from "@/modules/users/user-row-actions";
import { type KpiFilter, UsersKpis } from "@/modules/users/users-kpis";
import { api, sessionStore } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { type CsvColumn, exportToCsv, exportToJson } from "@/shared/utils/data-export";
import { useListView } from "@/shared/hooks/use-list-view";
import { useRoles } from "@/modules/authorization/api/rbac-groups";
import { useRevokeAllUserSessions } from "@/modules/users/api/user360";
import {
  type User,
  useCreateUser,
  useDeleteUser,
  useResetUserMfa,
  useSetUserStatus,
  useUpdateUser,
  useUserStats,
  useUserTrends,
} from "@/modules/users/api/users";

export const Route = createFileRoute("/_app/users/")({ component: UsersPage });

type UsersResponse = { items: User[]; next_cursor?: string };

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

function UsersPage() {
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const { t } = useTranslation("users");
  const access = useCapabilities();
  const canWriteUsers = access.can("user.write");
  const canCreateUsers = access.canAll(["user.write", "role.read", "role.write"]);
  const tenantId = useTenantId();
  const currentUserId = sessionStore.getUserId();
  const qc = useQueryClient();
  const rolesQ = useRoles();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [settingPassword, setSettingPassword] = useState<User | null>(null);
  const [previewUser, setPreviewUser] = useState<User | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [roleFilter, setRoleFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [pageSize, setPageSize] = useState(50);
  // Offset (page-number) paging so the console can jump to any page.
  const [page, setPage] = useState(0);

  const usersQ = useQuery({
    queryKey: ["users", tenantId, pageSize, page],
    queryFn: () =>
      api<UsersResponse>("/v1/users", {
        query: { limit: pageSize, offset: page * pageSize },
      }),
    enabled: !!tenantId,
  });
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
  }, [canCreateUsers, canWriteUsers]);

  // Page-level mutation hooks shared by the ⋯ row menu (via rowHandlers).
  const resetMfa = useResetUserMfa();
  const revokeAll = useRevokeAllUserSessions();
  const setStatus = useSetUserStatus();
  const deleteM = useDeleteUser();

  function afterMutation() {
    qc.invalidateQueries({ queryKey: ["users"] });
    qc.invalidateQueries({ queryKey: ["user-stats"] });
  }

  const rowHandlers: RowActionHandlers = {
    onEdit: setEditing,
    onSetPassword: setSettingPassword,
    onResetMfa: (u) =>
      openConfirm({
        title: t("detail.resetMfaConfirmTitle"),
        description: t("detail.resetMfaConfirmDescription"),
        variant: "destructive",
        confirmLabel: t("detail.resetMfaConfirmLabel"),
        onConfirm: () => resetMfa.mutate(u.id, { onSuccess: afterMutation }),
      }),
    onRevokeSessions: (u) =>
      openConfirm({
        title: t("detail.revokeAllTitle"),
        description: t("detail.revokeAllDescription"),
        variant: "destructive",
        confirmLabel: t("detail.revokeAllConfirm"),
        onConfirm: () => revokeAll.mutate(u.id),
      }),
    onToggleSuspend: (u) => {
      if (u.status === "suspended") {
        setStatus.mutate({ userId: u.id, status: "active" }, { onSuccess: afterMutation });
        return;
      }
      openConfirm({
        title: t("detail.suspendTitle"),
        description: t("detail.suspendDescription"),
        variant: "destructive",
        confirmLabel: t("detail.suspendConfirm"),
        onConfirm: () =>
          setStatus.mutate({ userId: u.id, status: "suspended" }, { onSuccess: afterMutation }),
      });
    },
    onDelete: (u) =>
      openConfirm({
        title: t("detail.deleteTitle"),
        description: t("detail.deleteDescription", { email: u.email }),
        variant: "destructive",
        confirmLabel: t("detail.deleteConfirm"),
        onConfirm: () => deleteM.mutate(u.id, { onSuccess: afterMutation }),
      }),
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

  // Numbered paging over the known total ("Showing 1–50 of 1,284").
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
  // KPI card → table filter (client-side over the current page, matching the
  // existing facet behaviour).
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
        {confirmDialog}
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
                <RefreshArrow className={usersQ.isFetching ? "animate-spin" : ""} />
                {t("common:actions.refresh")}
              </Button>
              {canWriteUsers ? (
                <Link
                  to="/users/import"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <CloudAdd /> {t("list.import")}
                </Link>
              ) : null}
              {canCreateUsers ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Add /> {t("list.newUser")}
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
                  tenantId={tenantId}
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

              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  {total !== undefined
                    ? t("pagination.showing", {
                        start: rangeStart,
                        end: rangeEnd,
                        total: total.toLocaleString(),
                      })
                    : t("pagination.showingSimple", { start: rangeStart, end: rangeEnd })}
                </span>
                <div className="flex items-center gap-2">
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
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={!hasPrev || usersQ.isFetching}
                      aria-label={t("pagination.prev")}
                      onClick={() => goToPage(page - 1)}
                    >
                      <ArrowLeftAlt className="size-4" />
                    </Button>
                    {totalPages !== undefined
                      ? pageWindow(page + 1, totalPages).map((p, i) =>
                          p === "…" ? (
                            <span
                              // biome-ignore lint/suspicious/noArrayIndexKey: ellipsis markers are positional
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
                      <ArrowRightAlt className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </DataState>
          </CardContent>
        </Card>

        <UserPreviewDrawer user={previewUser} onClose={() => setPreviewUser(null)} />

        {canCreateUsers ? (
          <CreateUserSheet
            open={creating}
            onOpenChange={setCreating}
            tenantId={tenantId}
            onCreated={afterMutation}
          />
        ) : null}

        {canWriteUsers ? (
          <>
            <EditUserSheet
              user={editing}
              isSelf={!!editing && editing.id === currentUserId}
              onOpenChange={(o) => !o && setEditing(null)}
              onSaved={() => {
                setEditing(null);
                afterMutation();
              }}
            />

            <SetPasswordSheet
              user={settingPassword}
              onOpenChange={(o) => !o && setSettingPassword(null)}
              onSaved={() => setSettingPassword(null)}
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
          <TickCircle className="size-3.5 text-success" aria-hidden="true" />
        ) : (
          <ShieldSecurity className="size-3.5 text-warning" aria-hidden="true" />
        )}
        {t("security.email")}
      </span>
      <span className="inline-flex items-center gap-1">
        {user.mfa_enabled ? (
          <ShieldTick className="size-3.5 text-success" aria-hidden="true" />
        ) : (
          <ShieldSecurity className="size-3.5 text-warning" aria-hidden="true" />
        )}
        {user.mfa_enabled ? t("security.mfaOn") : t("security.mfaOff")}
      </span>
    </div>
  );
}

type CreateUserSheetProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tenantId: string | null;
  onCreated: () => void;
};

function CreateUserSheet({ open, onOpenChange, tenantId, onCreated }: CreateUserSheetProps) {
  const { t } = useTranslation("users");
  const rolesQ = useRoles();
  const roles = useMemo(() => rolesQ.data?.items ?? [], [rolesQ.data?.items]);
  const [roleId, setRoleId] = useState("");

  // Default to a "member"-type role (else the least-privileged/last one) so a
  // created user is an organization member out of the box.
  useEffect(() => {
    if (!roleId && roles.length > 0) {
      const member = roles.find((r) => /member/i.test(r.name));
      setRoleId(member?.id ?? roles.at(-1)?.id ?? "");
    }
  }, [roles, roleId]);

  // Extracted to lib/users.ts so the qeetai create_user tool shares the same hook.
  const createM = useCreateUser();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <form
          className="flex h-full flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (!tenantId) return;
            const data = new FormData(e.currentTarget);
            createM.mutate(
              {
                tenant_id: tenantId,
                email: String(data.get("email") ?? "").trim(),
                password: String(data.get("password") ?? ""),
                display_name: String(data.get("display_name") ?? "").trim() || undefined,
                phone: String(data.get("phone") ?? "").trim() || undefined,
                role_id: roleId || undefined,
              },
              {
                onSuccess: () => {
                  onCreated();
                  onOpenChange(false);
                },
              },
            );
          }}
        >
          <SheetHeader>
            <SheetTitle>{t("create.title")}</SheetTitle>
            <SheetDescription>{t("create.description")}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">{t("create.email")}</FieldLabel>
                <Input id="email" name="email" type="email" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="display_name">{t("create.displayName")}</FieldLabel>
                <Input id="display_name" name="display_name" type="text" />
                <FieldDescription>{t("create.displayNameHelp")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="phone">{t("create.phone")}</FieldLabel>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+15555550100"
                  pattern="\+[1-9]\d{1,14}"
                />
                <FieldDescription>{t("create.phoneHelp")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="password">{t("create.password")}</FieldLabel>
                <Input id="password" name="password" type="password" minLength={8} required />
                <FieldDescription>{t("create.passwordHelp")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="role">Role</FieldLabel>
                <Select value={roleId} onValueChange={(v) => v && setRoleId(v)}>
                  <SelectTrigger id="role" aria-label="Role">
                    <SelectValue
                      placeholder={rolesQ.isLoading ? "Loading roles…" : "Select a role"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Grants organization membership — without a role the user won&apos;t appear in the
                  members list.
                </FieldDescription>
              </Field>
              {createM.error && (
                <Field>
                  <FieldError>{errorMessage(createM.error)}</FieldError>
                </Field>
              )}
            </FieldGroup>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <SheetClose render={<Button type="button" variant="outline" />}>
              {t("common:actions.cancel")}
            </SheetClose>
            <Button type="submit" disabled={createM.isPending || !tenantId}>
              {createM.isPending && <RefreshArrow className="animate-spin" />}
              {createM.isPending ? t("create.submitting") : t("create.submit")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

type EditUserSheetProps = {
  user: User | null;
  isSelf: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
};

function EditUserSheet({ user, isSelf, onOpenChange, onSaved }: EditUserSheetProps) {
  const { t } = useTranslation("users");
  // Reset selected status when the editing target changes.
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"active" | "suspended">(
    user?.status === "suspended" ? "suspended" : "active",
  );
  if (user && user.id !== trackedId) {
    setTrackedId(user.id);
    setStatus(user.status === "suspended" ? "suspended" : "active");
  }

  // Extracted to lib/users.ts so the qeetai update_user tool shares the same hook.
  const updateM = useUpdateUser();

  return (
    <Sheet open={!!user} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {user && (
          <form
            className="flex h-full flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const displayName = String(data.get("display_name") ?? "").trim();
              const phone = String(data.get("phone") ?? "").trim();
              updateM.mutate(
                {
                  userId: user.id,
                  body: {
                    display_name: displayName || null,
                    phone: phone || null,
                    // Don't allow suspending yourself.
                    ...(isSelf ? {} : { status }),
                  },
                },
                { onSuccess: onSaved },
              );
            }}
          >
            <SheetHeader>
              <SheetTitle>{t("edit.title")}</SheetTitle>
              <SheetDescription>{t("edit.description")}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="edit-email">{t("edit.email")}</FieldLabel>
                  <Input id="edit-email" value={user.email} readOnly disabled />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-display-name">{t("edit.displayName")}</FieldLabel>
                  <Input
                    id="edit-display-name"
                    name="display_name"
                    defaultValue={user.display_name ?? ""}
                    maxLength={200}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-phone">{t("edit.phone")}</FieldLabel>
                  <Input
                    id="edit-phone"
                    name="phone"
                    type="tel"
                    defaultValue={user.phone ?? ""}
                    placeholder="+15555550100"
                    pattern="\+[1-9]\d{1,14}"
                  />
                  <FieldDescription>{t("edit.phoneHelp")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel id="user-status-label">{t("edit.status")}</FieldLabel>
                  <Select
                    value={status}
                    onValueChange={(v) => v && setStatus(v as "active" | "suspended")}
                    disabled={isSelf}
                  >
                    <SelectTrigger aria-labelledby="user-status-label">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t("edit.statusActive")}</SelectItem>
                      <SelectItem value="suspended">{t("edit.statusSuspended")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {isSelf ? t("edit.statusSelfHelp") : t("edit.statusHelp")}
                  </FieldDescription>
                </Field>
                {updateM.error && (
                  <Field>
                    <FieldError>{errorMessage(updateM.error)}</FieldError>
                  </Field>
                )}
              </FieldGroup>
            </div>

            <SheetFooter className="flex-row justify-end gap-2 border-t">
              <SheetClose render={<Button type="button" variant="outline" />}>
                {t("common:actions.cancel")}
              </SheetClose>
              <Button type="submit" disabled={updateM.isPending}>
                {updateM.isPending && <RefreshArrow className="animate-spin" />}
                {updateM.isPending ? t("common:actions.saving") : t("common:actions.saveChanges")}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

type SetPasswordSheetProps = {
  user: User | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
};

function SetPasswordSheet({ user, onOpenChange, onSaved }: SetPasswordSheetProps) {
  const { t } = useTranslation("users");
  const setM = useMutation({
    mutationFn: (body: { password: string }) => {
      if (!user) throw new Error("No user selected");
      return api<void>(`/v1/users/${user.id}/password`, { method: "POST", body });
    },
    onSuccess: onSaved,
    meta: { successMessage: t("toast.passwordUpdated") },
  });

  return (
    <Sheet open={!!user} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {user && (
          <form
            className="flex h-full flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const password = String(data.get("password") ?? "");
              const confirm = String(data.get("confirm") ?? "");
              if (password !== confirm) {
                setM.reset();
                const el = e.currentTarget.elements.namedItem("confirm") as HTMLInputElement;
                el.setCustomValidity(t("setPassword.mismatch"));
                el.reportValidity();
                return;
              }
              setM.mutate({ password });
            }}
          >
            <SheetHeader>
              <SheetTitle>{t("setPassword.title")}</SheetTitle>
              <SheetDescription>
                {t("setPassword.descriptionPlain", { email: user.email })}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="new-password">{t("setPassword.newPassword")}</FieldLabel>
                  <Input
                    id="new-password"
                    name="password"
                    type="password"
                    minLength={8}
                    maxLength={256}
                    required
                    autoComplete="new-password"
                  />
                  <FieldDescription>{t("setPassword.newPasswordHelp")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm-password">
                    {t("setPassword.confirmPassword")}
                  </FieldLabel>
                  <Input
                    id="confirm-password"
                    name="confirm"
                    type="password"
                    minLength={8}
                    maxLength={256}
                    required
                    autoComplete="new-password"
                    onInput={(e) => (e.currentTarget as HTMLInputElement).setCustomValidity("")}
                  />
                </Field>
                {setM.error && (
                  <Field>
                    <FieldError>{errorMessage(setM.error)}</FieldError>
                  </Field>
                )}
                {setM.isSuccess && (
                  <Field>
                    <FieldDescription className="text-success">
                      {t("setPassword.success")}
                    </FieldDescription>
                  </Field>
                )}
              </FieldGroup>
            </div>

            <SheetFooter className="flex-row justify-end gap-2 border-t">
              <SheetClose render={<Button type="button" variant="outline" />}>
                {t("common:actions.cancel")}
              </SheetClose>
              <Button type="submit" disabled={setM.isPending}>
                {setM.isPending && <RefreshArrow className="animate-spin" />}
                {setM.isPending ? t("common:actions.saving") : t("setPassword.submit")}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
