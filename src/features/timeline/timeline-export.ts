// Client-side export of the identity timeline. Exports the events currently
// loaded into the view (scroll to load more before exporting for a longer
// range). Scoped to a single user's timeline — deliberately not the tenant-wide
// activity exporter, which walks a different endpoint.

import { toast } from "sonner";

import type { ActivityEvent } from "@/features/activity/types";

export type TimelineExportFormat = "csv" | "json";

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
  "source",
  "ip",
  "location",
  "device",
  "request_id",
] as const;

function csvCell(value: unknown): string {
  if (value == null) return "";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsvRow(ev: ActivityEvent): string {
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
    source: ev.source,
    ip: ev.ip,
    location: ev.location,
    device: ev.device,
    request_id: ev.request_id,
  };
  return CSV_HEADERS.map((h) => csvCell(cells[h])).join(",");
}

function download(content: string, mime: string, filename: string) {
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
    const csv = [CSV_HEADERS.join(","), ...events.map(toCsvRow)].join("\n");
    download(csv, "text/csv;charset=utf-8", name);
  } else {
    download(JSON.stringify(events, null, 2), "application/json", name);
  }

  const noun = events.length === 1 ? "event" : "events";
  toast.success(`Exported ${events.length.toLocaleString()} ${noun}`, {
    description: "Loaded events only — scroll to load more before exporting a longer range.",
  });
}
