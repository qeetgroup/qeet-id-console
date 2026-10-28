import { useState } from "react";
import { toast } from "sonner";

import i18n, { formatLocale } from "@/i18n";
import type { ActivityEvent } from "@/modules/activity";
import { toastError } from "@/platform/errors/error-toast";
import { type CsvColumn, downloadBlob, rowsToCsv } from "@/shared/utils/data-export";
import { type EventsQuery, fetchEvents } from "./api/timeline";

export type TimelineExportFormat = "csv" | "json";

const EXPORT_CAP = 10_000;
const EXPORT_PAGE = 200;

// The Activity export's columns, so the two files line up.
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
  { header: "browser", value: (e) => e.browser },
  { header: "request_id", value: (e) => e.request_id },
  { header: "metadata", value: (e) => e.metadata },
];

/**
 * Downloads every event the page's filters match, not only those on screen: it pages
 * GET /v1/activity, 200 at a time, up to 10,000. `exporting` is the format in flight.
 */
export function useTimelineExport(userId: string, query: EventsQuery) {
  const [exporting, setExporting] = useState<TimelineExportFormat | null>(null);

  const run = async (format: TimelineExportFormat) => {
    if (exporting) return;
    setExporting(format);
    try {
      const events: ActivityEvent[] = [];
      let cursor = "";
      do {
        const page = await fetchEvents(userId, query, cursor, EXPORT_PAGE);
        events.push(...page.events);
        cursor = page.next_cursor ?? "";
      } while (cursor && events.length < EXPORT_CAP);

      if (events.length === 0) {
        toast.info(i18n.t("timeline:export.empty"));
        return;
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const name = `timeline-${userId}-${stamp}.${format}`;
      if (format === "csv")
        downloadBlob(rowsToCsv(events, CSV_COLUMNS), "text/csv;charset=utf-8", name);
      else downloadBlob(JSON.stringify(events, null, 2), "application/json", name);
      toast.success(i18n.t("timeline:export.done", { count: events.length }), {
        description: cursor
          ? i18n.t("timeline:export.capped", { cap: EXPORT_CAP.toLocaleString(formatLocale()) })
          : undefined,
      });
    } catch (err) {
      toastError(err);
    } finally {
      setExporting(null);
    }
  };

  return { exporting, run };
}
