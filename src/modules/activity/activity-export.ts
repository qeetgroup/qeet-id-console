// Client-side export of the current activity filter to CSV / JSON / NDJSON.
// Walks the cursor pages of GET /v1/activity (via the shared fetchActivityPage)
// starting from the newest matching event, capped at EXPORT_ROW_CAP rows so an
// open-ended loop can't run forever on huge tenants. Modeled on the audit-logs
// exporter; export is client-side, so gating is UI-only (see the route's
// audit_export entitlement check).

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { fetchActivityPage } from "./activity-history";
import type { ActivityEvent, ActivityFilters } from "./types/activity.types";

export type ExportFormat = "csv" | "json" | "ndjson";

const EXPORT_ROW_CAP = 10_000;
const EXPORT_PAGE = 200;

// Flat, spreadsheet-friendly columns. Nested objects are JSON-encoded per cell.
const CSV_HEADERS = [
  "id",
  "at",
  "type",
  "category",
  "severity",
  "title",
  "actor_id",
  "actor_name",
  "actor_type",
  "target_type",
  "target_id",
  "ip",
  "request_id",
  "metadata",
] as const;

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSVRow(ev: ActivityEvent): string {
  const cells: Record<(typeof CSV_HEADERS)[number], unknown> = {
    id: ev.id,
    at: ev.at,
    type: ev.type,
    category: ev.category,
    severity: ev.severity,
    title: ev.title,
    actor_id: ev.actor?.id,
    actor_name: ev.actor?.name,
    actor_type: ev.actor?.type,
    target_type: ev.target?.type,
    target_id: ev.target?.id,
    ip: ev.ip,
    request_id: ev.request_id,
    metadata: ev.metadata,
  };
  return CSV_HEADERS.map((h) => csvCell(cells[h])).join(",");
}

function rowsToCSV(items: ActivityEvent[]): string {
  return [CSV_HEADERS.join(","), ...items.map(toCSVRow)].join("\n");
}

function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const MIME: Record<ExportFormat, string> = {
  csv: "text/csv;charset=utf-8",
  json: "application/json",
  ndjson: "application/x-ndjson",
};

/**
 * Returns an `exportAll(format)` action that downloads the current filter set,
 * plus an `exporting` flag (the in-flight format, or null).
 */
export function useActivityExport(filters: ActivityFilters) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const exportAll = useCallback(
    async (format: ExportFormat) => {
      if (exporting) return;
      setExporting(format);
      try {
        const all: ActivityEvent[] = [];
        let cursor = "";
        let truncated = false;
        do {
          const page = await fetchActivityPage(filters, cursor, EXPORT_PAGE);
          all.push(...page.events);
          cursor = page.next_cursor ?? "";
          if (all.length >= EXPORT_ROW_CAP) {
            truncated = true;
            break;
          }
        } while (cursor);

        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const name = `activity-${stamp}.${format}`;
        if (format === "csv") {
          downloadBlob(rowsToCSV(all), MIME.csv, name);
        } else if (format === "ndjson") {
          downloadBlob(all.map((e) => JSON.stringify(e)).join("\n"), MIME.ndjson, name);
        } else {
          downloadBlob(JSON.stringify(all, null, 2), MIME.json, name);
        }

        const noun = all.length === 1 ? "event" : "events";
        toast.success(`Exported ${all.length.toLocaleString()} ${noun}`, {
          description: truncated
            ? `Capped at ${EXPORT_ROW_CAP.toLocaleString()} rows. Narrow the filter or time range to capture more.`
            : undefined,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Export failed");
      } finally {
        setExporting(null);
      }
    },
    [filters, exporting],
  );

  return { exportAll, exporting };
}
