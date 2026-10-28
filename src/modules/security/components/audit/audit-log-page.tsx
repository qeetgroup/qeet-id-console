import {
  ChevronDownIcon,
  DownloadIcon,
  FileSearchIcon,
  RefreshCwIcon,
  SearchIcon,
} from "@qeetrix/icons";
import {
  Badge,
  Button,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Table,
  type TableColumn,
  Toggle,
  ToggleGroup,
} from "@qeetrix/react";
import {
  DataState,
  EmptyState,
  PageContent,
  PageHeader,
  Pagination,
} from "@qeetrix/react/experimental";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale } from "@/i18n";
import { formatEventTitle } from "@/modules/activity";
import { useEntitlements } from "@/modules/billing";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import { parseUserAgent } from "@/modules/users";
import {
  type AuditAnomaly,
  useAuditAnomalies,
  useAuditAnomalySummary,
  useResolveAuditAnomaly,
  useVerifyAuditChain,
} from "@/modules/security/api/audit-anomalies";
import {
  AUDIT_PAGE_SIZES,
  type AuditEvent,
  fetchAuditExport,
  useAuditLog,
} from "@/modules/security/api/audit-log";
import { useLogSinks } from "@/modules/security/api/log-sinks";
import { type AuditSearch, auditFilters, isFiltered } from "@/modules/security/audit-model";
import { useTenantId } from "@/platform/auth/session";
import { toastError } from "@/platform/errors/error-toast";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { type CsvColumn, downloadBlob, rowsToCsv } from "@/shared/utils/data-export";
import { BandPlaceholder } from "../band-placeholder";
import { usePeople } from "../use-people";
import { When } from "../when";
import { AuditBand, type ChainCheck } from "./audit-band";
import { ActorName, EventCell, ResourceName } from "./audit-cells";
import { AuditEventDrawer } from "./audit-event-drawer";
import { AuditToolbar } from "./audit-toolbar";
import { FlaggedView } from "./flagged-view";
import "../security.css";

const EXPORT_ROW_CAP = 10_000; // so the export's fetch loop can't run forever; hitting it says so
const FLAGGED_LIMIT = 200; // the most the server lists
type ExportFormat = "csv" | "json";

const CSV_HEADERS = [
  "id",
  "created_at",
  "actor_type",
  "actor_user_id",
  "action",
  "resource_type",
  "resource_id",
  "ip",
  "user_agent",
  "request_id",
] as const satisfies readonly (keyof AuditEvent)[];
const CSV_COLUMNS: CsvColumn<AuditEvent>[] = CSV_HEADERS.map((h) => ({
  header: h,
  value: (ev: AuditEvent) => ev[h],
}));

export type AuditLogPageProps = {
  search: AuditSearch;
  onSearchChange: (next: AuditSearch, options?: { replace?: boolean }) => void;
};

/**
 * Security › Monitoring › Audit log: every change and sign-in in the organisation, newest first,
 * each chained by hash to the one before. Filters live in the address; an event opens in a drawer
 * (`?event=`). Flagged, today's Intelligence page, is a view of the same log (`?view=flagged`).
 * The list is cursor-paged with no total: the pager steps through the cursors it has seen.
 */
export function AuditLogPage({ search, onSearchChange }: AuditLogPageProps) {
  const { t } = useTranslation("security");
  const tenantId = useTenantId();
  const access = useCapabilities();
  const people = usePeople();
  const runSensitive = useSensitiveAction();
  const flaggedView = search.view === "flagged";
  const flaggedStatus = search.status === "resolved" ? "resolved" : "open";
  const filters = useMemo(() => auditFilters(search), [search]);

  // Library gap (new): Pagination for cursor paging. The cursors of the pages seen so far stand in
  // for offsets, the first page's being undefined; the total is known only on the last page.
  const [pageSize, setPageSize] = useState<number>(AUDIT_PAGE_SIZES[0]);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageKey, setPageKey] = useState("");
  const key = JSON.stringify([filters, pageSize]);
  const page = pageKey === key ? cursors.length - 1 : 0;
  const cursor = pageKey === key ? cursors[page] : undefined;
  const log = useAuditLog(filters, cursor, pageSize);
  const rows = log.data?.items ?? [];

  const flagged = useAuditAnomalies(flaggedStatus, FLAGGED_LIMIT);
  const flaggedOpen = useAuditAnomalies("open", FLAGGED_LIMIT);
  const flaggedSummary = useAuditAnomalySummary();
  const resolve = useResolveAuditAnomaly();
  const sinks = useLogSinks();
  const verify = useVerifyAuditChain();
  const [chain, setChain] = useState<ChainCheck>({ state: "idle" });
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const canExport = useEntitlements().data?.features.audit_export !== false;
  const now = log.dataUpdatedAt || Date.now();

  const flaggedByEvent = useMemo(() => {
    const map = new Map<string, AuditAnomaly>();
    for (const a of [...(flaggedOpen.data?.items ?? []), ...(flagged.data?.items ?? [])]) {
      map.set(a.event_id, a);
    }
    return map;
  }, [flagged.data, flaggedOpen.data]);

  const set = (patch: Partial<AuditSearch>, options?: { replace?: boolean }) =>
    onSearchChange({ ...search, ...patch }, options);
  const openEvent = (id: string) => set({ event: id }, { replace: false });
  const byActor = (actorUserId: string) =>
    onSearchChange({ actor_user_id: actorUserId }, { replace: false });

  const goTo = (offset: number) => {
    const target = Math.round(offset / pageSize);
    const base = pageKey === key ? cursors : [undefined];
    if (target > page && log.data?.next_cursor) {
      setCursors([...base.slice(0, page + 1), log.data.next_cursor]);
    } else {
      setCursors(base.slice(0, Math.max(1, target + 1)));
    }
    setPageKey(key);
  };

  const checkChain = () => {
    setChain({ state: "checking" });
    verify.mutate(undefined, {
      onSuccess: (res) =>
        setChain(
          res.ok
            ? { state: "intact", rows: res.rows_checked }
            : {
                state: "broken",
                reason:
                  res.reason_code === "audit.chain_prev_hash_mismatch"
                    ? "link"
                    : res.reason_code === "audit.chain_row_hash_mismatch"
                      ? "row"
                      : "other",
              },
        ),
      onError: () => setChain({ state: "failed" }),
    });
  };

  const onResolve = (a: AuditAnomaly) =>
    runSensitive({
      capability: "audit.write",
      actionLabel: t("audit.flagged.resolveAction"),
      run: () => resolve.mutateAsync(a.id),
    }).catch(settleSensitiveAction);

  async function exportAll(format: ExportFormat) {
    if (!tenantId || exporting) return;
    setExporting(format);
    try {
      // Starts at the newest matching event, not at the page on screen.
      const { items, truncated } = await fetchAuditExport(tenantId, filters, EXPORT_ROW_CAP);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      if (format === "csv") {
        downloadBlob(rowsToCsv(items, CSV_COLUMNS), "text/csv;charset=utf-8", `audit-${stamp}.csv`);
      } else {
        downloadBlob(JSON.stringify(items, null, 2), "application/json", `audit-${stamp}.json`);
      }
      toast.success(t("audit.export.done", { count: items.length }), {
        description: truncated
          ? t("audit.export.capped", { cap: EXPORT_ROW_CAP.toLocaleString(formatLocale()) })
          : undefined,
      });
    } catch (err) {
      toastError(err);
    } finally {
      setExporting(null);
    }
  }

  const columns: TableColumn<AuditEvent>[] = [
    {
      id: "event",
      header: t("audit.columns.event"),
      primary: true,
      cell: (e) => <EventCell action={e.action} flagged={flaggedByEvent.has(e.id)} />,
    },
    {
      id: "actor",
      header: t("audit.columns.actor"),
      cell: (e) => <ActorName event={e} people={people} />,
    },
    {
      id: "resource",
      header: t("audit.columns.resource"),
      cell: (e) =>
        e.resource_type ? (
          <ResourceName type={e.resource_type} id={e.resource_id} people={people} stacked />
        ) : (
          "—"
        ),
    },
    {
      id: "address",
      header: t("audit.columns.address"),
      cell: (e) => (
        <span className="sec-two">
          <span className="sec-mono">{e.ip ?? "—"}</span>
          {e.user_agent ? <small>{parseUserAgent(e.user_agent).label}</small> : null}
        </span>
      ),
    },
    {
      id: "when",
      header: t("audit.columns.when"),
      width: 136,
      cell: (e) => <When at={e.created_at} now={now} />,
    },
  ];

  const viewSwitch = (
    <ToggleGroup
      aria-label={t("audit.view.label")}
      value={[flaggedView ? "flagged" : "all"]}
      onValueChange={(value) => {
        const next = value[0];
        if (!next) return;
        onSearchChange(next === "flagged" ? { view: "flagged" } : {}, { replace: false });
      }}
    >
      <Toggle value="all">{t("audit.view.all")}</Toggle>
      <Toggle value="flagged">
        {t("audit.view.flagged")}
        {flaggedSummary.data?.open ? (
          <Badge size="sm" tone="warning">
            {flaggedSummary.data.open.toLocaleString(formatLocale())}
          </Badge>
        ) : null}
      </Toggle>
    </ToggleGroup>
  );

  const openRow = rows.find((e) => e.id === search.event);
  const openFlag = search.event ? flaggedByEvent.get(search.event) : undefined;

  return (
    <PageTabs>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("audit.title")}
        description={t("audit.description")}
        actions={
          <>
            <IconButton
              icon={RefreshCwIcon}
              variant="ghost"
              tone="neutral"
              aria-label={t("audit.refresh")}
              disabled={log.isFetching}
              onClick={() => {
                void log.refetch();
                void flagged.refetch();
              }}
            />
            {canExport ? (
              <Menu>
                <MenuTrigger
                  render={
                    <Button variant="soft" icon={ChevronDownIcon} loading={!!exporting}>
                      {t("audit.export.button")}
                    </Button>
                  }
                />
                <MenuContent align="end">
                  <MenuItem
                    icon={DownloadIcon}
                    description={t("audit.export.csvLine")}
                    onClick={() => void exportAll("csv")}
                  >
                    {t("audit.export.csv")}
                  </MenuItem>
                  <MenuItem
                    icon={DownloadIcon}
                    description={t("audit.export.jsonLine")}
                    onClick={() => void exportAll("json")}
                  >
                    {t("audit.export.json")}
                  </MenuItem>
                </MenuContent>
              </Menu>
            ) : null}
          </>
        }
        summary={
          log.data ? (
            <AuditBand
              flagged={flaggedSummary.data}
              sinks={sinks.data?.items}
              chain={chain}
              onCheckChain={checkChain}
            />
          ) : log.isError ? undefined : (
            <BandPlaceholder />
          )
        }
        tabs={<PageTabList />}
      />
      <PageContent>
        <div className="ppl">
          {flaggedView ? (
            <FlaggedView
              items={flagged.data?.items ?? []}
              loading={flagged.isLoading}
              error={flagged.isError ? flagged.error : undefined}
              onRetry={() => flagged.refetch()}
              status={flaggedStatus}
              onStatusChange={(status) =>
                set({ status: status === "resolved" ? "resolved" : undefined })
              }
              summary={flaggedSummary.data}
              people={people}
              now={now}
              viewSwitch={viewSwitch}
              canResolve={access.can("audit.write")}
              canChange={access.can("audit.write")}
              onOpen={(a) => openEvent(a.event_id)}
              onResolve={onResolve}
              onActor={byActor}
            />
          ) : log.isError ? (
            <DataState error={log.error} onRetry={() => log.refetch()} />
          ) : (
            <>
              <Table<AuditEvent>
                label={t("audit.tableLabel")}
                rows={rows}
                rowId={(e) => e.id}
                rowLabel={(e) => formatEventTitle({ type: e.action })}
                columns={columns}
                loading={log.isFetching}
                onRowClick={(e) => openEvent(e.id)}
                toolbar={
                  <AuditToolbar
                    search={search}
                    onSearchChange={(next) => onSearchChange(next)}
                    people={people}
                    viewSwitch={viewSwitch}
                    onPage={rows.length}
                  />
                }
                rowActions={(e) => (
                  <>
                    <MenuItem onClick={() => openEvent(e.id)}>{t("audit.actions.open")}</MenuItem>
                    {e.actor_user_id ? (
                      <MenuItem onClick={() => byActor(e.actor_user_id ?? "")}>
                        {t("audit.actions.eventsByThem")}
                      </MenuItem>
                    ) : null}
                    {e.resource_type ? (
                      <MenuItem
                        onClick={() =>
                          onSearchChange({ resource_type: e.resource_type }, { replace: false })
                        }
                      >
                        {t("audit.actions.sameKind")}
                      </MenuItem>
                    ) : null}
                    <MenuSeparator />
                    <MenuItem
                      onClick={() =>
                        void navigator.clipboard
                          ?.writeText(e.id)
                          .then(() => toast.success(t("audit.actions.copied")))
                      }
                    >
                      {t("audit.actions.copyId")}
                    </MenuItem>
                  </>
                )}
                empty={
                  isFiltered(search) ? (
                    <EmptyState
                      size="section"
                      icon={SearchIcon}
                      title={t("audit.empty.filteredTitle")}
                      description={t("audit.empty.filteredDescription")}
                      actions={
                        <Button variant="ghost" onClick={() => onSearchChange({})}>
                          {t("common.clearFilters")}
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      size="section"
                      icon={FileSearchIcon}
                      title={t("audit.empty.title")}
                      description={t("audit.empty.description")}
                    />
                  )
                }
              />
              {rows.length && (page > 0 || log.data?.next_cursor) ? (
                <Pagination
                  offset={page * pageSize}
                  pageSize={pageSize}
                  itemsOnPage={rows.length}
                  // No total from the server: on the last page, what's been seen is the total.
                  total={log.data?.next_cursor ? undefined : page * pageSize + rows.length}
                  loading={log.isFetching}
                  onOffsetChange={goTo}
                  pageSizes={AUDIT_PAGE_SIZES}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCursors([undefined]);
                  }}
                />
              ) : null}
            </>
          )}
        </div>
      </PageContent>
      <AuditEventDrawer
        eventId={search.event}
        row={openRow}
        flagged={openFlag}
        people={people}
        now={now}
        onOpenChange={(open) => !open && set({ event: undefined })}
        onActor={byActor}
        onResolve={onResolve}
        resolving={resolve.isPending}
      />
    </PageTabs>
  );
}
