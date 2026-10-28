import { CircleCheckIcon, DownloadIcon, EyeIcon, TriangleAlertIcon } from "@qeetrix/icons";
import { Badge, Button, formatNumber, Heading, Table, Text } from "@qeetrix/react";
import {
  Alert,
  DataState,
  EmptyState,
  PageContent,
  PageHeader,
  Pagination,
} from "@qeetrix/react/experimental";
import { useMutation } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale } from "@/i18n";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import {
  DEFAULT_ERROR_FILTERS,
  type DirectoryEvent,
  type ErrorFilters,
  useDirectoryConnections,
  useDirectoryErrors,
} from "@/modules/directory/api/directory";
import { ExportTooLargeError, fetchErrorsExport } from "@/modules/directory/api/sync";
import type { DirectoryConnection } from "@/modules/directory/directory-model";
import { causeOf, problemsOf, runKey } from "@/modules/directory/sync-model";
import { type ErrorsFilters, periodDays } from "@/modules/directory/sync-search";
import { useTenantId } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import { exportToCsv } from "@/shared/utils/data-export";
import { BandPlaceholder } from "../band-placeholder";
import { ErrorDrawer } from "./error-drawer";
import { ErrorsBand } from "./errors-band";
import { ProblemList } from "./errors-problems";
import { ErrorBulkActions, ErrorRowMenu, ErrorsToolbar, useErrorColumns } from "./errors-table";
import { useConnectionNames } from "./sync-parts";
import { useErrorActions } from "./use-error-actions";
import "../connections/connections.css";
import "./sync.css";

const PAGE_SIZES = [25, 50, 100] as const;
const NO_CONNECTIONS: DirectoryConnection[] = [];
const NO_EVENTS: DirectoryEvent[] = [];
// Open failures whatever their age, up to the 90 days the server reads: the same read as the
// Connections page's and the tab's count, so they share it.
const OPEN: ErrorFilters = { ...DEFAULT_ERROR_FILTERS, days: 90, resolution: "open", limit: 100 };

export type SyncErrorsPageProps = {
  /** What the address narrows the list to. */
  filters: ErrorsFilters;
  onFiltersChange: (next: ErrorsFilters) => void;
};

/**
 * Directory › Directories › Sync errors, a list for fixing. The open failures come first as
 * problems, one per cause on a connection: what happened, to whom, how to fix it, and the fix as
 * the main action. Under them, every failure over the period, from the server's list (it filters,
 * searches and pages), to check again or mark resolved, one or several at a time.
 */
export function SyncErrorsPage({ filters, onFiltersChange }: SyncErrorsPageProps) {
  const { t } = useTranslation("directory");
  const tenantId = useTenantId();
  const canWrite = useCapabilities().can("connection.write");
  const headingId = useId();
  const n = (value: number) => formatNumber(value, formatLocale());
  const days = periodDays(filters.period ?? "90d");

  const [pageSize, setPageSize] = useState<number>(25);
  // New filters or a new page size start again from the first page, with nothing selected.
  const pagingKey = `${JSON.stringify(filters)}|${pageSize}`;
  const [paging, setPaging] = useState({ key: pagingKey, offset: 0 });
  const offset = paging.key === pagingKey ? paging.offset : 0;
  const [chosen, setChosen] = useState({ key: "", ids: [] as string[] });
  const selectionKey = `${pagingKey}|${offset}`;
  const selectedIds = chosen.key === selectionKey ? chosen.ids : [];
  const [shown, setShown] = useState<DirectoryEvent | null>(null);
  const [viewing, setViewing] = useState(false);
  const view = (e: DirectoryEvent) => {
    setShown(e);
    setViewing(true);
  };

  const connectionsQ = useDirectoryConnections();
  const connections = connectionsQ.data ?? NO_CONNECTIONS;
  const listFilters: ErrorFilters = {
    ...DEFAULT_ERROR_FILTERS,
    days,
    connection_id: filters.connection ?? "",
    resolution: filters.status ?? "",
    severity: filters.severity ?? "",
    q: filters.q ?? "",
  };
  const openQ = useDirectoryErrors(OPEN);
  // The 90 days unfiltered, on the list's first page: the same read as the list's, unfiltered.
  const allQ = useDirectoryErrors({ ...DEFAULT_ERROR_FILTERS, days: 90 });
  const listQ = useDirectoryErrors({ ...listFilters, limit: pageSize, offset }, { keep: true });

  const now = openQ.dataUpdatedAt || Date.now();
  const nameOf = useConnectionNames(connections);
  const actions = useErrorActions(nameOf);
  const columns = useErrorColumns({ connections, now });
  const problems = useMemo(() => problemsOf(openQ.data?.items ?? []), [openQ.data]);
  const rows = listQ.data?.items ?? NO_EVENTS;
  const openCount = openQ.data?.summary.open;
  const filtered = !!(filters.connection || filters.status || filters.severity || filters.q);
  // The drawer's failure as it is now, once a change reloads the list.
  const current = shown ? (rows.find((e) => e.id === shown.id) ?? shown) : null;

  const exporting = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      const records = await fetchErrorsExport(tenantId, listFilters);
      exportToCsv("directory-sync-errors", records, [
        { header: "failed_at", value: (e) => e.started_at },
        { header: "connection", value: (e) => nameOf(e.connection_id) },
        { header: "connection_id", value: (e) => e.connection_id },
        { header: "cause", value: (e) => t(`errors.causes.${causeOf(e)}.name`) },
        { header: "run", value: (e) => t(runKey(e)) },
        { header: "error_code", value: (e) => e.error_code },
        { header: "http_status", value: (e) => e.http_status },
        { header: "message", value: (e) => e.message },
        { header: "severity", value: (e) => e.severity },
        { header: "status", value: (e) => e.resolution },
        { header: "resolved_at", value: (e) => e.resolved_at ?? "" },
        { header: "resource_type", value: (e) => e.resource_type },
        { header: "resource_id", value: (e) => e.resource_id },
      ]);
    },
    onError: (err) =>
      toast.error(t("sync.exportFailed"), {
        description:
          err instanceof ExportTooLargeError ? t("sync.exportTooLarge") : errorMessage(err),
      }),
    meta: { silent: true }, // its own toast
  });

  const checkAgain = (events: readonly DirectoryEvent[]) => void actions.checkAgain(events);
  const resolve = (events: readonly DirectoryEvent[]) =>
    void actions.markResolved(events).then(() => setChosen({ key: "", ids: [] }));

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("errors.title")}
        count={openCount}
        description={t("errors.description")}
        actions={
          <Button
            variant="ghost"
            tone="neutral"
            icon={DownloadIcon}
            disabled={!listQ.data?.total}
            loading={exporting.isPending}
            onClick={() => exporting.mutate()}
          >
            {t("sync.export")}
          </Button>
        }
        summary={
          openQ.data && allQ.data && connectionsQ.data ? (
            <ErrorsBand
              open={openQ.data}
              all={allQ.data}
              connections={connections}
              filters={filters}
              now={now}
            />
          ) : openQ.isError || connectionsQ.isError ? undefined : (
            <BandPlaceholder />
          )
        }
        tabs={
          <PageTabs>
            <PageTabList badges={{ "/directory/sync-errors": openCount }} />
          </PageTabs>
        }
      />
      <PageContent>
        <div className="ppl sync">
          {!canWrite ? (
            <Alert tone="info" icon={EyeIcon} title={t("errors.readOnly.title")}>
              {t("errors.readOnly.description")}
            </Alert>
          ) : null}

          <section className="sync-block" aria-labelledby={`${headingId}-fix`}>
            <div className="sync-block-head">
              <Heading level={2} size="title-md" id={`${headingId}-fix`}>
                {t("errors.toFix")}
              </Heading>
              {problems.length ? (
                <Badge tone="danger">
                  {t("errors.problems", { count: problems.length, n: n(problems.length) })}
                </Badge>
              ) : null}
            </div>
            {openQ.isError ? (
              <DataState error={openQ.error} onRetry={() => openQ.refetch()} />
            ) : !openQ.data ? (
              <div className="sync-problem-loading" aria-busy="true" />
            ) : problems.length ? (
              <>
                <ProblemList
                  problems={problems}
                  connections={connections}
                  canWrite={canWrite}
                  pending={actions.pending}
                  onCheckAgain={actions.checkAgain}
                  onResolve={resolve}
                  now={now}
                />
                {openQ.data.summary.open > openQ.data.items.length ? (
                  <Text size="sm" tone="subtle">
                    {t("errors.newest", {
                      n: n(openQ.data.items.length),
                      total: n(openQ.data.summary.open),
                    })}
                  </Text>
                ) : null}
              </>
            ) : (
              <div className="sync-clear">
                <span className="sync-clear-icon" aria-hidden="true">
                  <CircleCheckIcon size={16} />
                </span>
                <span className="sync-two">
                  <span className="sync-main">{t("errors.allClear.title")}</span>
                  <small>{t("errors.allClear.description")}</small>
                </span>
              </div>
            )}
          </section>

          <section className="sync-block" aria-labelledby={`${headingId}-every`}>
            <div className="sync-block-head">
              <Heading level={2} size="title-md" id={`${headingId}-every`}>
                {t("errors.every")}
              </Heading>
            </div>
            {listQ.isError && !listQ.data ? (
              <DataState error={listQ.error} onRetry={() => listQ.refetch()} />
            ) : (
              <>
                <Table<DirectoryEvent>
                  label={t("errors.every")}
                  rows={rows}
                  rowId={(e) => e.id}
                  rowLabel={(e) =>
                    t("errors.rowLabel", {
                      cause: t(`errors.causes.${causeOf(e)}.name`),
                      connection: nameOf(e.connection_id),
                      date: e.started_at.slice(0, 10),
                    })
                  }
                  columns={columns}
                  loading={listQ.isLoading || listQ.isPlaceholderData}
                  onRowClick={view}
                  selectable={canWrite}
                  selected={selectedIds}
                  onSelectedChange={(ids) => setChosen({ key: selectionKey, ids })}
                  bulkActions={(ids) => (
                    <ErrorBulkActions
                      selected={rows.filter((e) => ids.includes(e.id))}
                      pending={actions.pending}
                      onCheckAgain={checkAgain}
                      onResolve={resolve}
                    />
                  )}
                  toolbar={
                    <ErrorsToolbar
                      filters={filters}
                      onFiltersChange={onFiltersChange}
                      connections={connections}
                      shown={listQ.data?.total ?? 0}
                      total={allQ.data?.total ?? 0}
                    />
                  }
                  rowActions={(e) => (
                    <ErrorRowMenu
                      event={e}
                      canWrite={canWrite}
                      onView={view}
                      onCheckAgain={checkAgain}
                      onResolve={resolve}
                    />
                  )}
                  empty={
                    filtered ? (
                      <EmptyState
                        size="section"
                        icon={TriangleAlertIcon}
                        title={t("errors.empty.filteredTitle")}
                        description={t("errors.empty.filteredDescription")}
                        actions={
                          <Button
                            variant="ghost"
                            onClick={() => onFiltersChange({ period: filters.period })}
                          >
                            {t("sync.clear")}
                          </Button>
                        }
                      />
                    ) : (
                      <EmptyState
                        size="section"
                        icon={CircleCheckIcon}
                        title={t("errors.empty.title", { days })}
                        description={t("errors.empty.description")}
                      />
                    )
                  }
                />
                {listQ.data?.total ? (
                  <Pagination
                    offset={offset}
                    pageSize={pageSize}
                    itemsOnPage={rows.length}
                    total={listQ.data.total}
                    loading={listQ.isPlaceholderData}
                    onOffsetChange={(next) => setPaging({ key: pagingKey, offset: next })}
                    pageSizes={PAGE_SIZES}
                    onPageSizeChange={setPageSize}
                  />
                ) : null}
              </>
            )}
          </section>
        </div>
      </PageContent>

      <ErrorDrawer
        open={viewing}
        event={current}
        connections={connections}
        canWrite={canWrite}
        pending={actions.pending}
        now={now}
        onClose={() => setViewing(false)}
        onCheckAgain={checkAgain}
        onResolve={resolve}
      />
    </>
  );
}
