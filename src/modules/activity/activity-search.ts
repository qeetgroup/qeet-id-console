// URL search params for the Activity workspace, the source of truth for its filters, mode,
// saved view and open event, so any view is shareable as a link.

import { z } from "zod";

import { isOneOf } from "@/shared/utils/one-of";
import { searchEnum, searchText } from "@/shared/utils/search-params";
import { type DateRange, presetToRange, TIME_PRESETS } from "./time-range";
import type { ActivityFilters, ActivityMode, Outcome, Severity } from "./types/activity.types";

const RANGE_KEYS = TIME_PRESETS.map((p) => p.value);

/**
 * Activity URL params. severity, category and type are comma-separated lists; `range` is a
 * TIME_PRESETS key, with RFC 3339 `from`/`to` used only when it is "custom"; `view` is the
 * applied saved view; `event` opens that event's drawer on `tab`. A blank or unknown value is
 * dropped.
 */
export const activitySearchSchema = z.object({
  q: searchText(),
  severity: searchText(),
  category: searchText(),
  type: searchText(),
  actor: searchText(),
  ip: searchText(),
  resource: searchText(),
  source: searchText(),
  status: searchText(),
  range: z
    .string()
    .refine((v) => isOneOf(RANGE_KEYS, v))
    .optional()
    .catch(undefined),
  from: searchText(),
  to: searchText(),
  mode: searchEnum(["live", "history"]),
  view: searchText(),
  event: searchText(),
  tab: searchEnum(["overview", "raw", "related"]),
});

export type ActivitySearch = z.infer<typeof activitySearchSchema>;
export type DrawerTab = NonNullable<ActivitySearch["tab"]>;

const SEVERITIES: Severity[] = ["info", "success", "warning", "error", "critical"];

/** The severities behind each outcome, matching the summary's by_outcome buckets. */
export const OUTCOME_TO_SEVERITY: Record<Outcome, Severity[]> = {
  success: ["success"],
  warning: ["warning"],
  failed: ["error", "critical"],
  info: ["info"],
};

/** Reverse-maps a severity selection to an outcome label, when it matches exactly. */
export function severityToOutcome(severity: Severity[]): Outcome | "" {
  const sorted = [...severity].sort().join(",");
  for (const [outcome, sevs] of Object.entries(OUTCOME_TO_SEVERITY) as [Outcome, Severity[]][]) {
    if ([...sevs].sort().join(",") === sorted) return outcome;
  }
  return "";
}

function csvToArray(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function arrayToCsv(v: string[]): string | undefined {
  return v.length > 0 ? v.join(",") : undefined;
}

/**
 * Resolves the URL search into ActivityFilters. Relative ranges resolve against the current
 * time, so memoise the result per navigation to keep the window and query key stable.
 */
export function searchToFilters(s: ActivitySearch): ActivityFilters {
  const range = s.range ?? "all";
  const custom: DateRange | undefined =
    range === "custom" && s.from
      ? { from: new Date(s.from), to: s.to ? new Date(s.to) : undefined }
      : undefined;
  const window = presetToRange(range, custom);
  const severity = csvToArray(s.severity).filter((v): v is Severity =>
    SEVERITIES.includes(v as Severity),
  );
  return {
    types: csvToArray(s.type),
    severity,
    category: csvToArray(s.category),
    actor: s.actor ?? "",
    q: s.q ?? "",
    from: window.from,
    to: window.to,
    source: s.source ?? "",
    status: s.status ?? "",
    ip: s.ip ?? "",
    resource: s.resource ?? "",
  };
}

export const DEFAULT_MODE: ActivityMode = "live";
