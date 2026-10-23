import {
  Button,
  cn,
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
} from "@qeetrix/icons";
import { useDeferredValue, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
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
  DirectoryDaysSelect,
  DirectoryPagination,
  DirectoryQueryError,
  DirectorySearch,
  DirectorySelect,
  DirectorySkeletonRows,
  DirectoryStat,
  DirectoryStatus,
} from "./directory-ui";
import { SyncErrorInsights } from "./sync-errors-page-insights";
import { SyncErrorSheet } from "./sync-errors-page-sheet";

export function SyncErrorsPage() {
  const tenantId = useTenantId();
  const { t } = useTranslation("directory");
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
      onExport={() => {
        action.reset(); // an earlier action's message would hide this export's outcome
        exporting.mutate();
      }}
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
  const { t } = useTranslation("directory");
  const [selected, setSelected] = useState<DirectoryEvent | null>(null);
  const change = (next: Partial<ErrorFilters>) =>
    onFiltersChange({ ...filters, ...next, offset: 0 });
  const nameFor = (id: string) =>
    connections.find((connection) => connection.id === id)?.name ??
    t("directory.activity.removedConnection");
  const retryable =
    page?.items.filter((event) => event.retryable && event.resolution === "open") ?? [];
  const summary = page?.summary;

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
        <DirectoryDaysSelect value={filters.days} onChange={(days) => change({ days })} />
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
            ...(["critical", "warning"] as const).map((value) => ({
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
            ...(["open", "resolved", "retried"] as const).map((value) => ({
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
                {(
                  [
                    "connection",
                    "code",
                    "message",
                    "severity",
                    "occurred",
                    "objects",
                    "status",
                    "actions",
                  ] as const
                ).map((column) => (
                  <TableHead key={column}>{t(`directory.errors.${column}`)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <DirectorySkeletonRows colSpan={8} />
              ) : (
                page?.items.map((event) => (
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
                      <p>{new Date(event.started_at).toLocaleString(formatLocale())}</p>
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
                ))
              )}
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

      <SyncErrorInsights page={page} nameFor={nameFor} />

      <SyncErrorSheet
        event={selected}
        nameFor={nameFor}
        canWrite={canWrite}
        acting={acting}
        onAction={onAction}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
