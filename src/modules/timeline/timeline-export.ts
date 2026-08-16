// Client-side export of the identity timeline. Exports the events currently
// loaded into the view (scroll to load more before exporting for a longer
// range). Scoped to a single user's timeline — deliberately not the tenant-wide
// activity exporter, which walks a different endpoint. CSV escaping + download
// are the shared helpers (shared/utils/data-export).

import { toast } from "sonner";

import type { ActivityEvent } from "@/modules/activity";
import { type CsvColumn, downloadBlob, rowsToCsv } from "@/shared/utils/data-export";

export type TimelineExportFormat = "csv" | "json";

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
  { header: "source", value: (e) => e.source },
  { header: "ip", value: (e) => e.ip },
  { header: "location", value: (e) => e.location },
  { header: "device", value: (e) => e.device },
  { header: "request_id", value: (e) => e.request_id },
];

export function exportTimelineEvents(
  events: ActivityEvent[],
  format: TimelineExportFormat,
  userId: string,
) {
  if (events.length === 0) {
    toast.error("No events to export in the current view.");
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `identity-timeline-${userId}-${stamp}.${format}`;

  if (format === "csv") {
    downloadBlob(rowsToCsv(events, CSV_COLUMNS), "text/csv;charset=utf-8", name);
  } else {
    downloadBlob(JSON.stringify(events, null, 2), "application/json", name);
  }

  const noun = events.length === 1 ? "event" : "events";
  toast.success(`Exported ${events.length.toLocaleString()} ${noun}`, {
    description: "Loaded events only — scroll to load more before exporting a longer range.",
  });
}
