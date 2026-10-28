import { ActivityIcon, BellPlusIcon, DownloadIcon } from "@qeetrix/icons";
import { Button, Table } from "@qeetrix/react";
import {
  DataState,
  EmptyState,
  PageContent,
  PageHeader,
  Pagination,
} from "@qeetrix/react/experimental";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import {
  DEFAULT_ERROR_FILTERS,
  DEFAULT_EVENT_FILTERS,
  type DirectoryEvent,
  type EventFilters,
  useDirectoryConnections,
  useDirectoryErrors,
  useDirectoryEvents,
} from "@/modules/directory/api/directory";
import {
  ExportTooLargeError,
  fetchActivityExport,
  useEventsByConnection,
} from "@/modules/directory/api/sync";
import type { DirectoryConnection } from "@/modules/directory/directory-model";
import { runKey } from "@/modules/directory/sync-model";
import { type ActivityFilters, periodDays } from "@/modules/directory/sync-search";
import { useTenantId } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import { exportToCsv } from "@/shared/utils/data-export";
import { BandPlaceholder } from "../band-placeholder";
import { ActivityBand } from "./activity-band";
import { ActivityDrawer } from "./activity-drawer";
import { ActivityRowMenu, ActivityToolbar, useActivityColumns } from "./activity-table";
import { AlertDialog } from "./alert-dialog";
import { useConnectionNames } from "./sync-parts";
import "../connections/connections.css";
import "./sync.css";

const PAGE_SIZES = [25, 50, 100] as const;
const NO_CONNECTIONS: DirectoryConnection[] = [];
const NO_EVENTS: DirectoryEvent[] = [];

export type SyncActivityPageProps = {
  /** What the address narrows the list to. */
  filters: ActivityFilters;
  onFiltersChange: (next: ActivityFilters) => void;
};

/**
 * Directory › Directories › Sync activity: every run, newest first, from the server's list (it
 * filters, searches and pages). The header's band covers the chosen period: its events a day with
 * the failures, each connection's share, what was synced and the latest run. A run opens its
 * details; a failed one leads to Sync errors. Alert me asks for a console notice on failures.
 */
export function SyncActivityPage({ filters, onFiltersChange }: SyncActivityPageProps) {
  const { t } = useTranslation("directory");
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const canWrite = useCapabilities().can("connection.write");
  const days = periodDays(filters.period ?? "30d");

  const [pageSize, setPageSize] = useState<number>(25);
  // New filters or a new page size start again from the first page.
  const pagingKey = `${JSON.stringify(filters)}|${pageSize}`;
  const [paging, setPaging] = useState({ key: pagingKey, offset: 0 });
  const offset = paging.key === pagingKey ? paging.offset : 0;
  // The run in the drawer stays while it closes, so its content doesn't vanish mid-animation.
  const [selected, setSelected] = useState<DirectoryEvent | null>(null);
  const [viewing, setViewing] = useState(false);
  const view = (e: DirectoryEvent) => {
    setSelected(e);
    setViewing(true);
  };
  const [alerting, setAlerting] = useState(false);

  const connectionsQ = useDirectoryConnections();
  const connections = connectionsQ.data ?? NO_CONNECTIONS;
  // The band follows the period only; the list follows every filter.
  const period: EventFilters = { ...DEFAULT_EVENT_FILTERS, days };
  const listFilters: EventFilters = {
    ...period,
    connection_id: filters.connection ?? "",
    status: filters.result ?? "",
    q: filters.q ?? "",
  };
  const monthQ = useDirectoryEvents({ ...period, limit: 1 });
  const failedQ = useDirectoryEvents({ ...period, status: "failed", limit: 100 });
  const listQ = useDirectoryEvents({ ...listFilters, limit: pageSize, offset }, true, {
    keep: true,
  });
  const openQ = useDirectoryErrors({
    ...DEFAULT_ERROR_FILTERS,
    days: 90,
    resolution: "open",
    limit: 100,
  });
  const ids = useMemo(() => connections.map((c) => c.id), [connections]);
  const perConnection = useEventsByConnection(ids, days);
  const byConnection = new Map(
    perConnection.flatMap((q, i) => (q.data && ids[i] ? [[ids[i], q.data.summary] as const] : [])),
  );

  const now = monthQ.dataUpdatedAt || Date.now();
  const columns = useActivityColumns({ connections, now });
  const nameOf = useConnectionNames(connections);
  const rows = listQ.data?.items ?? NO_EVENTS;
  const total = monthQ.data?.summary.total;
  const filtered = !!(filters.connection || filters.result || filters.q);

  const exporting = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      const records = await fetchActivityExport(tenantId, listFilters);
      exportToCsv("directory-sync-activity", records, [
        { header: "started_at", value: (e) => e.started_at },
        { header: "connection", value: (e) => nameOf(e.connection_id) },
        { header: "connection_id", value: (e) => e.connection_id },
        { header: "run", value: (e) => t(runKey(e)) },
        { header: "operation", value: (e) => e.operation },
        { header: "trigger", value: (e) => e.trigger },
        { header: "resource_type", value: (e) => e.resource_type },
        { header: "resource_id", value: (e) => e.resource_id },
        { header: "result", value: (e) => e.status },
        { header: "users_synced", value: (e) => e.users_synced },
        { header: "groups_synced", value: (e) => e.groups_synced },
        { header: "duration_ms", value: (e) => e.duration_ms },
        { header: "error_code", value: (e) => e.error_code },
        { header: "http_status", value: (e) => e.http_status },
      ]);
    },
    onError: (err) =>
      toast.error(t("sync.exportFailed"), {
        description:
          err instanceof ExportTooLargeError ? t("sync.exportTooLarge") : errorMessage(err),
      }),
    meta: { silent: true }, // its own toast
  });

  const openErrors = (e: DirectoryEvent) =>
    void navigate({ to: "/directory/sync-errors", search: { connection: e.connection_id } });

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("activity.title")}
        count={total}
        description={t("activity.description")}
        actions={
          <>
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
            {canWrite ? (
              <Button variant="soft" icon={BellPlusIcon} onClick={() => setAlerting(true)}>
                {t("activity.alertMe")}
              </Button>
            ) : null}
          </>
        }
        summary={
          monthQ.data && failedQ.data && connectionsQ.data ? (
            <ActivityBand
              days={days}
              month={monthQ.data}
              failed={failedQ.data.items}
              connections={connections}
              byConnection={byConnection}
              filters={filters}
              now={now}
            />
          ) : monthQ.isError || connectionsQ.isError ? undefined : (
            <BandPlaceholder />
          )
        }
        tabs={
          <PageTabs>
            <PageTabList badges={{ "/directory/sync-errors": openQ.data?.summary.open }} />
          </PageTabs>
        }
      />
      <PageContent>
        <div className="ppl sync">
          {listQ.isError && !listQ.data ? (
            <DataState error={listQ.error} onRetry={() => listQ.refetch()} />
          ) : (
            <>
              <Table<DirectoryEvent>
                label={t("activity.title")}
                rows={rows}
                rowId={(e) => e.id}
                rowLabel={(e) =>
                  t("activity.rowLabel", { run: t(runKey(e)), connection: nameOf(e.connection_id) })
                }
                columns={columns}
                loading={listQ.isLoading || listQ.isPlaceholderData}
                onRowClick={view}
                toolbar={
                  <ActivityToolbar
                    filters={filters}
                    onFiltersChange={onFiltersChange}
                    connections={connections}
                    shown={listQ.data?.total ?? 0}
                    total={total ?? 0}
                  />
                }
                rowActions={(e) => (
                  <ActivityRowMenu event={e} onView={view} onOpenErrors={openErrors} />
                )}
                empty={
                  filtered ? (
                    <EmptyState
                      size="section"
                      icon={ActivityIcon}
                      title={t("activity.empty.filteredTitle")}
                      description={t("activity.empty.filteredDescription")}
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
                      icon={ActivityIcon}
                      title={t("activity.empty.title", { days })}
                      description={t("activity.empty.description")}
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
        </div>
      </PageContent>

      <ActivityDrawer
        open={viewing}
        event={selected}
        connections={connections}
        now={now}
        onClose={() => setViewing(false)}
        onOpenErrors={openErrors}
      />
      {canWrite ? (
        <AlertDialog
          open={alerting}
          onOpenChange={setAlerting}
          connections={connections}
          connectionId={filters.connection}
        />
      ) : null}
    </>
  );
}
