import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  buttonVariants,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FieldError,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  Clock3Icon,
  DownloadIcon,
  EllipsisIcon,
  FileCheckIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UserCheckIcon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  DEFAULT_SUSPENDED_FILTERS,
  fetchSuspendedExport,
  safeSuspendedCsvValue,
  SUSPENSION_REASONS,
  type SuspendedDirectoryUser,
  type SuspendedFilters,
  type SuspendedUsersPage,
  type SuspensionReview,
  useReactivateUsers,
  useReviewSuspension,
  useSuspendedUsers,
} from "@/modules/users";
import { sessionStore } from "@/platform/api/client";
import { PageHeader } from "@/platform/components/page-header";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { exportToCsv } from "@/shared/utils/data-export";
import { initials } from "@/shared/utils/initials";
import {
  DIRECTORY_ACTION,
  DIRECTORY_PAGE,
  DIRECTORY_PANEL,
  DirectoryDonut,
  DirectoryPanel,
  DirectoryPagination,
  DirectoryQueryError,
  DirectorySearch,
  DirectorySelect,
  DirectoryStat,
  DirectoryStatus,
} from "./directory-ui";

export function SuspendedPage() {
  const { t } = useTranslation("dashboard");
  const [filters, setFilters] = useState(DEFAULT_SUSPENDED_FILTERS);
  const search = useDeferredValue(filters.q);
  const query = useSuspendedUsers({ ...filters, q: search });
  const access = useCapabilities();
  const sensitive = useSensitiveAction();
  const reactivate = useReactivateUsers();
  const review = useReviewSuspension();
  const [reviewing, setReviewing] = useState<SuspendedDirectoryUser | null>(null);
  const [actionError, setActionError] = useState<string>();
  const exporting = useMutation({
    mutationFn: async () => {
      const rows = await fetchSuspendedExport(filters);
      exportToCsv("suspended-users", rows, [
        { header: "id", value: (user) => user.id },
        { header: "name", value: (user) => safeSuspendedCsvValue(user.display_name) },
        { header: "email", value: (user) => safeSuspendedCsvValue(user.email) },
        { header: "team", value: (user) => safeSuspendedCsvValue(user.team) },
        { header: "reason", value: (user) => user.reason },
        { header: "source", value: (user) => user.source },
        { header: "risk", value: (user) => user.risk },
        { header: "review", value: (user) => user.review },
        { header: "suspended_at", value: (user) => user.suspended_at },
        { header: "last_sign_in", value: (user) => user.last_sign_in },
      ]);
    },
  });
  const report = (error: unknown) => {
    if (!(error instanceof SensitiveActionCancelled)) setActionError(errorMessage(error));
  };

  async function reactivateSelected(users: SuspendedDirectoryUser[]) {
    setActionError(undefined);
    try {
      await sensitive({
        capability: "user.write",
        actionLabel: t("directory.suspended.reactivate"),
        confirm: {
          title: t("directory.suspended.reactivateTitle", { count: users.length }),
          description: t("directory.suspended.reactivateDescription"),
          confirmLabel: t("directory.suspended.reactivate"),
          tone: "default",
        },
        run: () => reactivate.mutateAsync(users.map((user) => user.id)),
      });
    } catch (error) {
      report(error);
    }
  }

  async function saveReview(input: SuspensionReview) {
    if (!reviewing) return;
    setActionError(undefined);
    try {
      await sensitive({
        capability: "user.write",
        actionLabel: t("directory.suspended.saveReview"),
        run: () => review.mutateAsync({ id: reviewing.id, review: input }),
      });
      setReviewing(null);
    } catch (error) {
      report(error);
    }
  }

  return (
    <>
      <SuspendedView
        page={query.isError ? undefined : query.data}
        filters={filters}
        onFiltersChange={setFilters}
        loading={query.isPending}
        error={query.isError}
        busy={query.isFetching}
        retry={query.refetch}
        canWrite={access.can("user.write")}
        canReviewPolicy={access.can("policy.read")}
        currentUserId={sessionStore.getUserId()}
        onReactivate={(users) => void reactivateSelected(users)}
        onReview={setReviewing}
        acting={reactivate.isPending || review.isPending}
        onExport={() => exporting.mutate()}
        exporting={exporting.isPending}
        actionError={actionError ?? (exporting.isError ? errorMessage(exporting.error) : undefined)}
      />
      {reviewing ? (
        <SuspensionReviewDialog
          key={reviewing.id}
          user={reviewing}
          busy={review.isPending}
          error={actionError}
          onSave={(input) => void saveReview(input)}
          onClose={() => setReviewing(null)}
        />
      ) : null}
    </>
  );
}

export function SuspendedView({
  page,
  filters,
  onFiltersChange,
  loading,
  error,
  busy,
  retry,
  canWrite,
  canReviewPolicy,
  currentUserId,
  onReactivate,
  onReview,
  acting,
  onExport,
  exporting,
  actionError,
}: {
  page?: SuspendedUsersPage;
  filters: SuspendedFilters;
  onFiltersChange: (filters: SuspendedFilters) => void;
  loading: boolean;
  error: boolean;
  busy: boolean;
  retry: () => unknown;
  canWrite: boolean;
  canReviewPolicy: boolean;
  currentUserId: string | null;
  onReactivate: (users: SuspendedDirectoryUser[]) => void;
  onReview: (user: SuspendedDirectoryUser) => void;
  acting: boolean;
  onExport: () => void;
  exporting: boolean;
  actionError?: string;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const items = page?.items ?? [];
  const manageable = (user: SuspendedDirectoryUser) =>
    canWrite && user.can_manage && user.id !== currentUserId;
  const eligible = items.filter(manageable);
  const selectedUsers = eligible.filter((user) => selected.has(user.id));
  const change = (next: Partial<SuspendedFilters>) =>
    onFiltersChange({ ...filters, ...next, offset: 0 });
  const summary = page?.summary;
  const colors = [
    "var(--color-rose-500)",
    "var(--color-orange-400)",
    "var(--color-blue-400)",
    "var(--color-emerald-500)",
    "var(--color-violet-400)",
    "var(--color-slate-400)",
  ];
  const riskColor = (risk: string) =>
    risk === "high"
      ? "var(--color-rose-500)"
      : risk === "medium"
        ? "var(--color-amber-400)"
        : risk === "low"
          ? "var(--color-emerald-500)"
          : "var(--color-slate-400)";

  return (
    <div className={DIRECTORY_PAGE}>
      <PageHeader
        title={t("directory.suspended.title")}
        description={t("directory.suspended.description")}
        actions={
          <>
            <Button
              variant="outline"
              className={DIRECTORY_ACTION}
              onClick={onExport}
              disabled={exporting || !page?.total}
            >
              <DownloadIcon />
              {t("directory.suspended.export")}
            </Button>
            {canReviewPolicy ? (
              <Link
                to="/settings/organization/security-policy"
                className={cn(buttonVariants({ size: "sm" }), DIRECTORY_ACTION)}
              >
                <ShieldCheckIcon />
                {t("directory.suspended.policies")}
              </Link>
            ) : null}
          </>
        }
      />
      {error ? <DirectoryQueryError retry={retry} busy={busy} /> : null}
      {actionError ? (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}
      <section
        aria-label={t("directory.suspended.summary")}
        className="grid gap-3 @min-[460px]/directory-page:grid-cols-2 @min-[900px]/directory-page:grid-cols-5"
      >
        <DirectoryStat
          label={t("directory.suspended.total")}
          value={summary?.total}
          icon={UsersRoundIcon}
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.suspended.highRisk")}
          value={summary?.high_risk}
          icon={TriangleAlertIcon}
          tone="danger"
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.suspended.byPolicy")}
          value={summary?.policy}
          icon={FileCheckIcon}
          tone="warning"
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.suspended.manual")}
          value={summary?.manual}
          icon={UserCheckIcon}
          tone="info"
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.suspended.pending")}
          value={summary?.pending}
          icon={Clock3Icon}
          tone="info"
          loading={loading}
        />
      </section>
      <search
        aria-label={t("directory.suspended.filters")}
        className={cn(DIRECTORY_PANEL, "flex flex-wrap items-end gap-3 p-3")}
      >
        <DirectorySearch
          label={t("directory.suspended.search")}
          value={filters.q}
          onChange={(q) => change({ q })}
        />
        <DirectorySelect
          label={t("directory.suspended.reason")}
          value={filters.reason}
          onChange={(reason) => change({ reason })}
          options={[
            { value: "all", label: t("directory.suspended.allReasons") },
            ...SUSPENSION_REASONS.map((value) => ({
              value,
              label: t(`directory.suspended.reasons.${value}`),
            })),
          ]}
        />
        <DirectorySelect
          label={t("directory.suspended.source")}
          value={filters.source}
          onChange={(source) => change({ source })}
          options={[
            { value: "all", label: t("directory.suspended.allSources") },
            ...["manual", "scim", "ldap", "policy", "unknown", "external"].map((value) => ({
              value,
              label: t(`directory.suspended.sources.${value}`),
            })),
          ]}
        />
        <DirectorySelect
          label={t("directory.suspended.team")}
          value={filters.team}
          onChange={(team) => change({ team })}
          options={[
            { value: "all", label: t("directory.suspended.allTeams") },
            ...(page?.teams ?? []).map((value) => ({ value, label: value })),
          ]}
        />
        <DirectorySelect
          label={t("directory.suspended.risk")}
          value={filters.risk}
          onChange={(risk) => change({ risk })}
          options={[
            { value: "all", label: t("directory.suspended.allRisks") },
            ...["high", "medium", "low", "unknown"].map((value) => ({
              value,
              label: t(`directory.suspended.risks.${value}`),
            })),
          ]}
        />
        {filters.review ? (
          <Button variant="ghost" size="sm" onClick={() => change({ review: "" })}>
            <XIcon />
            {t("directory.suspended.pending")}
          </Button>
        ) : null}
      </search>

      <section className={DIRECTORY_PANEL} aria-label={t("directory.suspended.title")}>
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <h2 className="font-heading text-sm font-semibold">
            {t("directory.suspended.title")}{" "}
            <span className="font-normal text-muted-foreground">({page?.total ?? 0})</span>
          </h2>
          {selectedUsers.length ? (
            <Button size="sm" disabled={acting} onClick={() => onReactivate(selectedUsers)}>
              <RotateCcwIcon />
              {t("directory.suspended.reactivateSelected", { count: selectedUsers.length })}
            </Button>
          ) : null}
        </header>
        <div className="overflow-x-auto">
          <Table className="w-full min-w-260 table-fixed text-xs [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:px-2.5 [&_th]:text-[10px]">
            <colgroup>
              {canWrite ? <col className="w-8" /> : null}
              <col className="w-32" />
              <col className="w-38" />
              <col className="w-20" />
              <col className="w-31" />
              <col className="w-18" />
              <col className="w-26" />
              <col className="w-26" />
              <col className="w-26" />
              <col className="w-10" />
            </colgroup>
            <TableHeader className="border-y border-border/60 bg-muted/25">
              <TableRow>
                {canWrite ? (
                  <TableHead>
                    <input
                      type="checkbox"
                      className="size-3.5 accent-primary"
                      aria-label={t("directory.suspended.selectAll")}
                      checked={
                        eligible.length > 0 && eligible.every((user) => selected.has(user.id))
                      }
                      disabled={acting || !eligible.length}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? new Set(eligible.map((user) => user.id))
                            : new Set(),
                        )
                      }
                    />
                  </TableHead>
                ) : null}
                {[
                  "name",
                  "email",
                  "team",
                  "reason",
                  "source",
                  "since",
                  "status",
                  "lastSignIn",
                  "actions",
                ].map((column) => (
                  <TableHead key={column} aria-sort={column === "since" ? "descending" : undefined}>
                    {t(`directory.suspended.${column}`)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? [0, 1, 2].map((row) => (
                    <TableRow key={row}>
                      <TableCell colSpan={10}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : items.map((user) => (
                    <TableRow key={user.id}>
                      {canWrite ? (
                        <TableCell>
                          <input
                            type="checkbox"
                            className="size-3.5 accent-primary"
                            aria-label={t("directory.suspended.select", {
                              name: user.display_name || user.email,
                            })}
                            disabled={acting || !manageable(user)}
                            checked={selected.has(user.id)}
                            onChange={() =>
                              setSelected((current) => {
                                const next = new Set(current);
                                if (next.has(user.id)) next.delete(user.id);
                                else next.add(user.id);
                                return next;
                              })
                            }
                          />
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar user={user} />
                          <span
                            className="min-w-0 truncate font-medium"
                            title={user.display_name || user.email}
                          >
                            {user.display_name || user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell
                        className="max-w-44 truncate text-muted-foreground"
                        title={user.email}
                      >
                        {user.email}
                      </TableCell>
                      <TableCell className="truncate text-muted-foreground" title={user.team}>
                        {user.team || "--"}
                      </TableCell>
                      <TableCell
                        className="truncate"
                        title={t(`directory.suspended.reasons.${user.reason}`)}
                      >
                        {t(`directory.suspended.reasons.${user.reason}`, {
                          defaultValue: user.reason,
                        })}
                      </TableCell>
                      <TableCell>
                        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-700 dark:text-blue-400">
                          {t(`directory.suspended.sources.${user.source}`, {
                            defaultValue: user.source,
                          })}
                        </span>
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground"
                        title={
                          user.suspended_at
                            ? new Date(user.suspended_at).toLocaleString(i18n.resolvedLanguage)
                            : undefined
                        }
                      >
                        {user.suspended_at
                          ? new Date(user.suspended_at).toLocaleDateString(i18n.resolvedLanguage, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : t("directory.notReported")}
                      </TableCell>
                      <TableCell>
                        <DirectoryStatus
                          label={t(
                            user.risk === "unknown" && user.review === "pending"
                              ? "directory.suspended.pending"
                              : `directory.suspended.risks.${user.risk}`,
                          )}
                          tone={
                            user.risk === "high"
                              ? "danger"
                              : user.risk === "medium" || user.review === "pending"
                                ? "warning"
                                : user.risk === "low"
                                  ? "success"
                                  : "neutral"
                          }
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.last_sign_in
                          ? new Date(user.last_sign_in).toLocaleDateString(i18n.resolvedLanguage, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "--"}
                      </TableCell>
                      <TableCell>
                        {manageable(user) ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  disabled={acting}
                                  aria-label={t("directory.suspended.rowActions", {
                                    name: user.display_name || user.email,
                                  })}
                                />
                              }
                            >
                              <EllipsisIcon />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onReview(user)}>
                                <FileCheckIcon />
                                {t("directory.suspended.review")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onReactivate([user])}>
                                <RotateCcwIcon />
                                {t("directory.suspended.reactivate")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span
                            className="text-[10px] text-muted-foreground"
                            title={t("directory.suspended.managedElsewhere")}
                          >
                            --
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              {!loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                    {t(error ? "directory.loadError" : "directory.suspended.empty")}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        <DirectoryPagination
          total={page?.total ?? 0}
          limit={filters.limit}
          offset={filters.offset}
          busy={busy}
          onChange={(offset) => onFiltersChange({ ...filters, offset })}
        />
      </section>

      <div className="grid gap-3 @min-[850px]/directory-page:grid-cols-3">
        <DirectoryPanel
          title={t("directory.suspended.reasonsTitle")}
          description={t("directory.suspended.reasonsDescription")}
        >
          <div className="flex flex-wrap items-center gap-4">
            <DirectoryDonut
              value={page ? String(page.total) : "--"}
              label={t("directory.suspended.label")}
              values={(page?.reasons ?? []).map((reason, index) => ({
                label: reason.key,
                count: reason.count,
                color: colors[index % colors.length],
              }))}
            />
            <dl className="min-w-32 flex-1 space-y-2 text-[11px]">
              {page?.reasons.map((reason) => (
                <div key={reason.key} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">
                    {t(`directory.suspended.reasons.${reason.key}`, { defaultValue: reason.key })}
                  </dt>
                  <dd className="tabular-nums">{reason.count}</dd>
                </div>
              ))}
            </dl>
          </div>
        </DirectoryPanel>
        <DirectoryPanel
          title={t("directory.suspended.queueTitle")}
          description={t("directory.suspended.queueDescription")}
        >
          <ul className="space-y-3">
            {page?.queue.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md text-start outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                  onClick={() => onReview(user)}
                  disabled={!manageable(user) || acting}
                >
                  <UserAvatar user={user} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {user.display_name || user.email}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {t(`directory.suspended.reasons.${user.reason}`)}
                    </span>
                  </span>
                  {user.suspended_at ? (
                    <TimeSince
                      value={user.suspended_at}
                      className="text-[10px] text-muted-foreground"
                    />
                  ) : null}
                  {manageable(user) ? (
                    <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          {page?.summary.pending ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 h-7 px-0 text-xs text-primary"
              onClick={() => change({ review: "pending" })}
            >
              {t("directory.suspended.viewPending", { count: page.summary.pending })}
              <ChevronRightIcon />
            </Button>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">
              {t(page ? "directory.suspended.noPending" : "directory.notReported")}
            </p>
          )}
        </DirectoryPanel>
        <DirectoryPanel
          title={t("directory.suspended.riskTitle")}
          description={t("directory.suspended.riskDescription")}
        >
          <div className="flex flex-wrap items-center gap-4">
            <DirectoryDonut
              value={page ? String(page.total) : "--"}
              label={t("directory.suspended.label")}
              values={(page?.risks ?? []).map((risk) => ({
                label: risk.key,
                count: risk.count,
                color: riskColor(risk.key),
              }))}
            />
            <dl className="min-w-28 flex-1 space-y-3 text-xs">
              {page?.risks.map((risk) => (
                <div key={risk.key} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {t(`directory.suspended.risks.${risk.key}`)}
                  </dt>
                  <dd className="tabular-nums">{risk.count}</dd>
                </div>
              ))}
            </dl>
          </div>
        </DirectoryPanel>
      </div>
    </div>
  );
}

function UserAvatar({ user }: { user: SuspendedDirectoryUser }) {
  const name = user.display_name || user.email;
  return (
    <Avatar className="size-6 shrink-0">
      <AvatarImage src={user.avatar_url ?? undefined} alt={name} />
      <AvatarFallback className="bg-muted text-[10px] text-muted-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function SuspensionReviewDialog({
  user,
  busy,
  error,
  onSave,
  onClose,
}: {
  user: SuspendedDirectoryUser;
  busy: boolean;
  error?: string;
  onSave: (input: SuspensionReview) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("dashboard");
  const [input, setInput] = useState<SuspensionReview>({
    reason: user.reason,
    risk: user.risk,
    review: user.review === "reviewed" ? "reviewed" : "pending",
  });
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("directory.suspended.review")}</DialogTitle>
          <DialogDescription>{user.display_name || user.email}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) onSave(input);
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            <DirectorySelect
              label={t("directory.suspended.reason")}
              value={input.reason}
              onChange={(reason) => setInput({ ...input, reason })}
              options={SUSPENSION_REASONS.map((value) => ({
                value,
                label: t(`directory.suspended.reasons.${value}`),
              }))}
            />
            <DirectorySelect
              label={t("directory.suspended.risk")}
              value={input.risk}
              onChange={(risk) => setInput({ ...input, risk })}
              options={["unknown", "low", "medium", "high"].map((value) => ({
                value,
                label: t(`directory.suspended.risks.${value}`),
              }))}
            />
            <DirectorySelect
              label={t("directory.suspended.reviewState")}
              value={input.review}
              onChange={(value) => setInput({ ...input, review: value as "pending" | "reviewed" })}
              options={[
                { value: "pending", label: t("directory.suspended.pending") },
                { value: "reviewed", label: t("directory.suspended.reviewed") },
              ]}
            />
            {error ? <FieldError>{error}</FieldError> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("directory.cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {t("directory.suspended.saveReview")}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
