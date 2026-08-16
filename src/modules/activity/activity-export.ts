// Client-side export of the current activity filter to CSV / JSON / NDJSON.
// Walks the cursor pages of GET /v1/activity (via the shared fetchActivityPage)
// starting from the newest matching event, capped at EXPORT_ROW_CAP rows so an
// open-ended loop can't run forever on huge tenants. CSV escaping + download are
// the shared helpers (shared/utils/data-export); export is client-side, so
// gating is UI-only (see the route's audit_export entitlement check).

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { errorMessage } from "@/platform/errors/user-message";
import { type CsvColumn, downloadBlob, rowsToCsv } from "@/shared/utils/data-export";
import { fetchActivityPage } from "./activity-history";
import type { ActivityEvent, ActivityFilters } from "./types/activity.types";

export type ExportFormat = "csv" | "json" | "ndjson";

const EXPORT_ROW_CAP = 10_000;
const EXPORT_PAGE = 200;

// Flat, spreadsheet-friendly columns. Nested objects are JSON-encoded per cell
// by the shared csvCell escaper.
const CSV_COLUMNS: CsvColumn<ActivityEvent>[] = [
  { header: "id", value: (e) => e.id },
  { header: "at", value: (e) => e.at },
  { header: "type", value: (e) => e.type },
  { header: "category", value: (e) => e.category },
  { header: "severity", value: (e) => e.severity },
  { header: "title", value: (e) => e.title },
  { header: "actor_id", value: (e) => e.actor?.id },
  { header: "actor_name", value: (e) => e.actor?.name },
  { header: "actor_type", value: (e) => e.actor?.type },
  { header: "target_type", value: (e) => e.target?.type },
  { header: "target_id", value: (e) => e.target?.id },
  { header: "ip", value: (e) => e.ip },
  { header: "request_id", value: (e) => e.request_id },
  { header: "metadata", value: (e) => e.metadata },
];

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
          downloadBlob(rowsToCsv(all, CSV_COLUMNS), MIME.csv, name);
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
        toast.error(errorMessage(err));
      } finally {
        setExporting(null);
      }
    },
    [filters, exporting],
  );

  return { exportAll, exporting };
}
