import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { toastError } from "@/platform/errors/error-toast";
import { type CsvColumn, downloadBlob, rowsToCsv } from "@/shared/utils/data-export";
import {
  DownloadIcon,
  FileSearchIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  XIcon,
} from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PageHeader } from "@/platform/components/page-header";
import { useTenantId } from "@/platform/auth/session";
import { useEntitlements } from "@/modules/billing";
import {
  type AuditEvent,
  type AuditLogFilters,
  fetchAuditExport,
  useAuditLog,
} from "../api/audit-log";

const EXPORT_ROW_CAP = 10_000; // so the fetch loop can't run forever; hitting it shows a warning

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
  "request_id",
  "metadata",
] as const satisfies readonly (keyof AuditEvent)[];

const CSV_COLUMNS: CsvColumn<AuditEvent>[] = CSV_HEADERS.map((h) => ({
  header: h,
  value: (ev: AuditEvent) => ev[h],
}));

/**
 * Renders the audit log: free-text search and exact filters, cursor paging and export. The
 * filters live in the URL, so the route owns them.
 */
export function AuditLogsPage({
  filters,
  onFiltersChange,
}: {
  filters: AuditLogFilters;
  onFiltersChange: (next: AuditLogFilters) => void;
}) {
  const { t } = useTranslation("security");
  const tenantId = useTenantId();
  const setFilters = (updater: (prev: AuditLogFilters) => AuditLogFilters) =>
    onFiltersChange(updater(filters));
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

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
      toast.success(t("auditLogs.exported", { count: items.length }), {
        description: truncated
          ? t("auditLogs.exportCapped", { cap: EXPORT_ROW_CAP.toLocaleString() })
          : undefined,
      });
    } catch (err) {
      toastError(err);
    } finally {
      setExporting(null);
    }
  }

  const auditQ = useAuditLog(filters, cursor);

  const hasFilters = Object.values(filters).some(Boolean);
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const itemCount = auditQ.data?.items?.length ?? 0;
  // Export is a paid feature; viewing is not. It runs client-side, so hiding the button is the
  // gate.
  const canExport = useEntitlements().data?.features.audit_export !== false;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        description={t("auditLogs.description")}
        actions={
          <>
            {canExport && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm" disabled={!!exporting}>
                      {exporting ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
                      {exporting
                        ? t("auditLogs.exporting", {
                            format: exporting.toUpperCase(),
                          })
                        : t("auditLogs.export")}
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" sideOffset={4} className="min-w-36">
                  <DropdownMenuItem onClick={() => exportAll("csv")}>
                    {t("auditLogs.exportCsv")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportAll("json")}>
                    {t("auditLogs.exportJson")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => auditQ.refetch()}
              disabled={auditQ.isFetching}
            >
              <RefreshCwIcon className={auditQ.isFetching ? "animate-spin" : ""} />
              {t("auditLogs.refresh")}
            </Button>
          </>
        }
      />

      {/* Filter bar */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          {/* Committed on Enter; supports quoted phrases, -exclusions and OR. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFilters((f) => ({ ...f, q: searchDraft }));
              setCursor(undefined);
            }}
            className="flex gap-2"
          >
            <Input
              className="flex-1"
              placeholder={t("auditLogs.filter.searchPlaceholder")}
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              aria-label={t("auditLogs.filter.searchLabel")}
            />
            <Button type="submit" variant="outline" size="sm">
              {t("auditLogs.filter.search")}
            </Button>
          </form>
          {/* Exact-match filters + clear */}
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              placeholder={t("auditLogs.filter.actionPlaceholder")}
              value={filters.action}
              onChange={(e) => {
                setFilters((f) => ({ ...f, action: e.target.value }));
                setCursor(undefined);
              }}
            />
            <Input
              placeholder={t("auditLogs.filter.resourceTypePlaceholder")}
              value={filters.resource_type}
              onChange={(e) => {
                setFilters((f) => ({ ...f, resource_type: e.target.value }));
                setCursor(undefined);
              }}
            />
            <Input
              placeholder={t("auditLogs.filter.actorPlaceholder")}
              value={filters.actor_user_id}
              onChange={(e) => {
                setFilters((f) => ({ ...f, actor_user_id: e.target.value }));
                setCursor(undefined);
              }}
            />
            <Button
              variant="outline"
              disabled={!hasFilters}
              onClick={() => {
                setFilters(() => ({
                  q: "",
                  action: "",
                  resource_type: "",
                  actor_user_id: "",
                }));
                setSearchDraft("");
                setCursor(undefined);
              }}
            >
              <XIcon /> {t("auditLogs.filter.clear")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("auditLogs.list.title")}</CardTitle>
          <CardDescription>{t("auditLogs.list.count", { count: itemCount })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={auditQ.isLoading}
            isError={auditQ.isError}
            error={auditQ.error}
            isEmpty={!auditQ.data?.items?.length}
            emptyIcon={FileSearchIcon}
            emptyTitle={t("auditLogs.list.empty")}
          >
            {auditQ.data && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("auditLogs.list.columns.time")}</TableHead>
                      <TableHead>{t("auditLogs.list.columns.actor")}</TableHead>
                      <TableHead>{t("auditLogs.list.columns.action")}</TableHead>
                      <TableHead>{t("auditLogs.list.columns.resource")}</TableHead>
                      <TableHead>{t("auditLogs.list.columns.ip")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditQ.data.items.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell>
                          <TimeSince value={ev.created_at} className="font-mono text-xs" />
                        </TableCell>
                        <TableCell>
                          <Badge variant="muted">{ev.actor_type}</Badge>
                          {ev.actor_user_id && (
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                              {ev.actor_user_id.slice(0, 8)}…
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{ev.action}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {ev.resource_type}
                          {ev.resource_id && (
                            <span className="ml-1 font-mono text-xs">
                              ({ev.resource_id.slice(0, 8)}…)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {ev.ip ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(cursor || auditQ.data.next_cursor) && (
                  <Pagination
                    hasPrev={!!cursor}
                    hasNext={!!auditQ.data.next_cursor}
                    onFirst={() => setCursor(undefined)}
                    onNext={() => setCursor(auditQ.data?.next_cursor)}
                    itemsOnPage={auditQ.data.items.length}
                    pageSize={50}
                    loading={auditQ.isFetching}
                  />
                )}
              </>
            )}
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}
