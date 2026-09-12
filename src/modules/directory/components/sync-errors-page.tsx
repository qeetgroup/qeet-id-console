import {
  Button,
  cn,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
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
import {
  CircleCheckIcon,
  CircleXIcon,
  DownloadIcon,
  EllipsisIcon,
  NetworkIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
  UsersRoundIcon,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useTranslation } from "react-i18next";

import { useTenantId } from "@/platform/auth/session";
import { PageHeader } from "@/platform/components/page-header";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import { exportToCsv } from "@/shared/utils/data-export";
import {
  DEFAULT_ERROR_FILTERS,
  type DirectoryErrorPage,
  type DirectoryEvent,
  type ErrorFilters,
  fetchDirectoryErrorExport,
  useDirectoryConnections,
  useDirectoryErrorAction,
  useDirectoryErrors,
} from "../api/directory";
import type { DirectoryConnection } from "../directory-model";
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

export function SyncErrorsPage() {
  const tenantId = useTenantId();
  const { t } = useTranslation("dashboard");
  const access = useCapabilities();
  const [filters, setFilters] = useState(DEFAULT_ERROR_FILTERS);
  const deferredSearch = useDeferredValue(filters.q);
  const errors = useDirectoryErrors({ ...filters, q: deferredSearch });
  const connections = useDirectoryConnections();
  const action = useDirectoryErrorAction();
  const exporting = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      const rows = await fetchDirectoryErrorExport(tenantId, filters);
      exportToCsv("directory-sync-errors", rows, [
        { header: "id", value: (row) => row.id },
        { header: "connection_id", value: (row) => row.connection_id },
        { header: "error_code", value: (row) => row.error_code },
        { header: "message", value: (row) => row.message },
        { header: "severity", value: (row) => row.severity },
        { header: "occurred_at", value: (row) => row.started_at },
        { header: "resource_type", value: (row) => row.resource_type },
        { header: "resource_id", value: (row) => row.resource_id },
        { header: "status", value: (row) => row.resolution },
      ]);
    },
  });
  return (
    <SyncErrorsView
      page={errors.isError ? undefined : errors.data}
      connections={connections.data ?? []}
      filters={filters}
      onFiltersChange={setFilters}
      loading={errors.isPending}
      busy={errors.isFetching}
      error={errors.isError}
      retry={errors.refetch}
      canWrite={access.can("connection.write")}
      onAction={(events, operation) => action.mutate({ events, action: operation })}
      acting={action.isPending}
      onExport={() => exporting.mutate()}
      exporting={exporting.isPending}
      actionMessage={
        action.isError
          ? errorMessage(action.error)
          : action.data
            ? t("directory.errors.actionResult", action.data)
            : exporting.isError
              ? errorMessage(exporting.error)
              : undefined
      }
    />
  );
}

export function SyncErrorsView({
  page,
  connections,
  filters,
  onFiltersChange,
  loading,
  busy,
  error,
  retry,
  canWrite,
  onAction,
  acting,
  onExport,
  exporting,
  actionMessage,
}: {
  page?: DirectoryErrorPage;
  connections: DirectoryConnection[];
  filters: ErrorFilters;
  onFiltersChange: (filters: ErrorFilters) => void;
  loading: boolean;
  busy: boolean;
  error: boolean;
  retry: () => unknown;
  canWrite: boolean;
  onAction: (events: DirectoryEvent[], action: "retry" | "resolve") => void;
  acting: boolean;
  onExport: () => void;
  exporting: boolean;
  actionMessage?: string;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const [selected, setSelected] = useState<DirectoryEvent | null>(null);
  const change = (next: Partial<ErrorFilters>) =>
    onFiltersChange({ ...filters, ...next, offset: 0 });
  const nameFor = (id: string) =>
    connections.find((connection) => connection.id === id)?.name ??
    t("directory.activity.removedConnection");
  const retryable =
    page?.items.filter((event) => event.retryable && event.resolution === "open") ?? [];
  const summary = page?.summary;
  const colors = [
    "var(--color-rose-500)",
    "var(--color-orange-400)",
    "var(--color-amber-400)",
    "var(--color-blue-400)",
    "var(--color-slate-400)",
  ];

  return (
    <div className={DIRECTORY_PAGE}>
      <PageHeader
        title={t("directory.errors.title")}
        description={t("directory.errors.description")}
        actions={
          <>
            <Button
              variant="outline"
              className={DIRECTORY_ACTION}
              onClick={onExport}
              disabled={exporting || !page?.total}
            >
              <DownloadIcon /> {t("directory.errors.export")}
            </Button>
            {canWrite ? (
              <Button
                className={DIRECTORY_ACTION}
                disabled={acting || retryable.length === 0}
                onClick={() => onAction(retryable, "retry")}
                title={
                  retryable.length
                    ? t("directory.errors.retryVisible")
                    : t("directory.errors.sourceRetry")
                }
              >
                <RefreshCwIcon /> {t("directory.errors.retryFailed")}
              </Button>
            ) : null}
          </>
        }
      />
      {error ? <DirectoryQueryError retry={retry} busy={busy} /> : null}
      {actionMessage ? (
        <p role="status" className="text-sm">
          {actionMessage}
        </p>
      ) : null}
      <search
        aria-label={t("directory.errors.filters")}
        className={cn(DIRECTORY_PANEL, "flex flex-wrap gap-2 p-3")}
      >
        <DirectorySelect
          label={t("directory.dateRange")}
          value={String(filters.days)}
          onChange={(value) => change({ days: Number(value) })}
          options={[7, 30, 90].map((days) => ({
            value: String(days),
            label: t("directory.lastDays", { days }),
          }))}
        />
        <DirectorySelect
          label={t("directory.activity.connection")}
          value={filters.connection_id}
          onChange={(connection_id) => change({ connection_id })}
          options={[
            { value: "all", label: t("directory.allConnections") },
            ...connections.map((connection) => ({ value: connection.id, label: connection.name })),
          ]}
        />
        <DirectorySelect
          label={t("directory.errors.severity")}
          value={filters.severity}
          onChange={(severity) => change({ severity })}
          options={[
            { value: "all", label: t("directory.errors.allSeverities") },
            ...["critical", "warning"].map((value) => ({
              value,
              label: t(`directory.errors.${value}`),
            })),
          ]}
        />
        <DirectorySelect
          label={t("directory.errors.status")}
          value={filters.resolution}
          onChange={(resolution) => change({ resolution })}
          options={[
            { value: "all", label: t("directory.allStatuses") },
            ...["open", "resolved", "retried"].map((value) => ({
              value,
              label: t(`directory.errors.${value}`),
            })),
          ]}
        />
        <DirectorySearch
          label={t("directory.errors.search")}
          value={filters.q}
          onChange={(q) => change({ q })}
        />
      </search>
      <section
        aria-label={t("directory.errors.summary")}
        className="grid gap-3 @min-[460px]/directory-page:grid-cols-2 @min-[900px]/directory-page:grid-cols-5"
      >
        <DirectoryStat
          label={t("directory.errors.openErrors")}
          value={summary?.open}
          icon={CircleXIcon}
          tone="danger"
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.errors.critical")}
          value={summary?.critical}
          icon={TriangleAlertIcon}
          tone="danger"
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.errors.warning")}
          value={summary?.warning}
          icon={TriangleAlertIcon}
          tone="warning"
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.errors.retriedSuccess")}
          value={summary?.retried}
          icon={CircleCheckIcon}
          tone="success"
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.errors.impacted")}
          value={summary?.impacted_users}
          icon={UsersRoundIcon}
          loading={loading}
          detail={t("directory.errors.knownObjects")}
        />
      </section>

      <section className={DIRECTORY_PANEL} aria-label={t("directory.errors.title")}>
        <header className="px-4 py-3">
          <h2 className="font-heading text-sm font-semibold">
            {t("directory.errors.title")}{" "}
            <span className="font-normal text-muted-foreground">({page?.total ?? 0})</span>
          </h2>
        </header>
        <div className="overflow-x-auto">
          <Table className="min-w-250 text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:text-[10px]">
            <TableHeader className="border-y border-border/60 bg-muted/25">
              <TableRow>
                {[
                  "connection",
                  "code",
                  "message",
                  "severity",
                  "occurred",
                  "objects",
                  "status",
                  "actions",
                ].map((column) => (
                  <TableHead key={column}>{t(`directory.errors.${column}`)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? [0, 1, 2].map((index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : page?.items.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <NetworkIcon className="size-4" />
                          </span>
                          <span className="font-medium">{nameFor(event.connection_id)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-1 text-[10px]">
                          {event.error_code}
                        </code>
                      </TableCell>
                      <TableCell className="max-w-64">
                        <p className="font-medium">{event.message}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {t(`directory.errors.categories.${event.category}`, {
                            defaultValue: event.category,
                          })}
                        </p>
                      </TableCell>
                      <TableCell>
                        <DirectoryStatus
                          label={t(`directory.errors.${event.severity || "warning"}`)}
                          tone={event.severity === "critical" ? "danger" : "warning"}
                        />
                      </TableCell>
                      <TableCell>
                        <p>{new Date(event.started_at).toLocaleString(i18n.resolvedLanguage)}</p>
                        <TimeSince
                          value={event.started_at}
                          className="text-[10px] text-muted-foreground"
                        />
                      </TableCell>
                      <TableCell>
                        <p>{t(`directory.errors.resource.${event.resource_type}`)}</p>
                        <p
                          className="mt-1 max-w-24 truncate text-[10px] text-muted-foreground"
                          title={event.resource_id}
                        >
                          {event.resource_id || t("directory.notReported")}
                        </p>
                      </TableCell>
                      <TableCell>
                        <DirectoryStatus
                          label={t(`directory.errors.${event.resolution}`)}
                          tone={event.resolution === "open" ? "danger" : "success"}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => setSelected(event)}
                          aria-label={t("directory.errors.details", { code: event.error_code })}
                        >
                          <EllipsisIcon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              {!loading && !page?.items.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    {t(error ? "directory.loadError" : "directory.errors.empty")}
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
          title={t("directory.errors.categoriesTitle")}
          description={t("directory.errors.categoriesDescription")}
        >
          <div className="flex flex-wrap items-center gap-4">
            <DirectoryDonut
              value={page ? String(page.total) : "--"}
              label={t("directory.errors.errors")}
              values={(page?.categories ?? []).map((category, index) => ({
                label: category.key,
                count: category.count,
                color: colors[index % colors.length],
              }))}
            />
            <dl className="min-w-28 flex-1 space-y-2 text-xs">
              {page?.categories.map((category) => (
                <div key={category.key} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {t(`directory.errors.categories.${category.key}`, {
                      defaultValue: category.key,
                    })}
                  </dt>
                  <dd className="tabular-nums">{category.count}</dd>
                </div>
              ))}
            </dl>
          </div>
        </DirectoryPanel>
        <DirectoryPanel
          title={t("directory.errors.connectionsTitle")}
          description={t("directory.errors.connectionsDescription")}
        >
          <div className="space-y-3">
            {page?.connections.slice(0, 5).map((connection) => (
              <div
                key={connection.key}
                className="grid grid-cols-[minmax(0,1fr)_minmax(3rem,1fr)_auto] items-center gap-3 text-xs"
              >
                <span className="truncate" title={nameFor(connection.key)}>
                  {nameFor(connection.key)}
                </span>
                <progress
                  className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-rose-400 [&::-moz-progress-bar]:bg-rose-400"
                  value={connection.count}
                  max={Math.max(1, page.connections[0]?.count ?? 1)}
                  aria-label={nameFor(connection.key)}
                />
                <span className="tabular-nums">{connection.count}</span>
              </div>
            ))}
            {!page?.connections.length ? (
              <p className="py-10 text-center text-xs text-muted-foreground">
                {t("directory.errors.empty")}
              </p>
            ) : null}
          </div>
        </DirectoryPanel>
        <DirectoryPanel title={t("directory.errors.remediationTitle")}>
          <ul className="space-y-3">
            {page?.remediations.map((event) => (
              <li key={event.id} className="flex items-start gap-2">
                <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs">{nameFor(event.connection_id)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t(`directory.errors.${event.resolution}`)}
                  </p>
                </div>
                {event.resolved_at ? (
                  <TimeSince
                    value={event.resolved_at}
                    className="shrink-0 text-[10px] text-muted-foreground"
                  />
                ) : null}
              </li>
            ))}
          </ul>
          {!page?.remediations.length ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              {t("directory.errors.noRemediation")}
            </p>
          ) : null}
        </DirectoryPanel>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("directory.errors.detailTitle")}</SheetTitle>
            <SheetDescription>{selected ? nameFor(selected.connection_id) : ""}</SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="space-y-5 p-5 text-sm">
              <code>{selected.error_code}</code>
              <p>{selected.message}</p>
              <DirectoryStatus
                label={t(`directory.errors.${selected.resolution}`)}
                tone={selected.resolution === "open" ? "danger" : "success"}
              />
              {!selected.retryable ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("directory.errors.sourceRetry")}
                </p>
              ) : null}
              {canWrite && selected.resolution === "open" ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={acting}
                    onClick={() => {
                      onAction([selected], "resolve");
                      setSelected(null);
                    }}
                  >
                    {t("directory.errors.resolve")}
                  </Button>
                  {selected.retryable ? (
                    <Button
                      disabled={acting}
                      onClick={() => {
                        onAction([selected], "retry");
                        setSelected(null);
                      }}
                    >
                      <RefreshCwIcon />
                      {t("directory.errors.retry")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
