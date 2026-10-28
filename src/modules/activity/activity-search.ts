// The Activity page's address: its filters, time range, applied saved view and open event, so any
// view of the log is a link someone can share. Other pages link here too: the Organisation page's
// History opens one event with `?range=custom&from=…&to=…&event=<id>`, and filters by `resource`.

import { z } from "zod";

import { isOneOf } from "@/shared/utils/one-of";
import { searchText } from "@/shared/utils/search-params";
import {
  ACTIVITY_RANGES,
  type ActivityRange,
  DEFAULT_ACTIVITY_RANGE,
  presetToRange,
} from "./time-range";
import type { ActivityFilters, Severity } from "./types/activity.types";

/**
 * Activity URL params. `severity`, `category` and `type` are comma-separated lists; `range` is one
 * of ACTIVITY_RANGES (the last 24 hours when absent), with RFC 3339 `from`/`to` only when it is
 * "custom"; `actor` is a person's ID; `view` is the applied saved view; `event` opens that event. A
 * blank or unknown value is dropped.
 */
export const activitySearchSchema = z.object({
  q: searchText(),
  severity: searchText(),
  category: searchText(),
  type: searchText(),
  actor: searchText(),
  ip: searchText(),
  resource: searchText(),
  // A string, not an enum type, so other pages' links (`range: "custom"`) type-check as written.
  range: z
    .string()
    .refine((v) => isOneOf(ACTIVITY_RANGES, v))
    .optional()
    .catch(undefined),
  from: searchText(),
  to: searchText(),
  view: searchText(),
  event: searchText(),
});

export type ActivitySearch = z.infer<typeof activitySearchSchema>;

const SEVERITIES: Severity[] = ["info", "success", "warning", "error", "critical"];

/** The page's three views of the log, each a severity filter in the address. */
export const ACTIVITY_TABS = ["all", "failed", "critical"] as const;
export type ActivityTab = (typeof ACTIVITY_TABS)[number];

/** The `severity` each view sets: Failed is the summary's "failed" bucket (error and critical). */
export const TAB_SEVERITY: Record<ActivityTab, string | undefined> = {
  all: undefined,
  failed: "error,critical",
  critical: "critical",
};

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

/** The known severities in a `severity` param, lowest first. */
export function severityList(severity: string | undefined): Severity[] {
  const listed = csvToArray(severity);
  return SEVERITIES.filter((s) => listed.includes(s));
}

/** Which view a `severity` param is; any other selection is a filter on All events. */
export function tabOf(severity: string | undefined): ActivityTab {
  const list = severityList(severity).join(",");
  if (list === TAB_SEVERITY.failed) return "failed";
  if (list === TAB_SEVERITY.critical) return "critical";
  return "all";
}

/** A valid RFC 3339 moment, or "". */
function moment(value: string | undefined): string {
  if (!value) return "";
  const at = Date.parse(value);
  return Number.isNaN(at) ? "" : new Date(at).toISOString();
}

/** The range the address asks for: a custom one needs a start, else it's the default. */
export function rangeOf(s: Pick<ActivitySearch, "range" | "from">): ActivityRange {
  if (s.range === "custom") return moment(s.from) ? "custom" : DEFAULT_ACTIVITY_RANGE;
  return s.range && isOneOf(ACTIVITY_RANGES, s.range) ? s.range : DEFAULT_ACTIVITY_RANGE;
}

/**
 * Resolves the URL search into ActivityFilters. A custom range keeps the exact moments the link
 * gives; relative ranges resolve against the current time, so memoise the result per navigation
 * to keep the window and query key stable.
 */
export function searchToFilters(s: ActivitySearch): ActivityFilters {
  const range = rangeOf(s);
  const window =
    range === "custom" ? { from: moment(s.from), to: moment(s.to) } : presetToRange(range);
  return {
    types: csvToArray(s.type),
    severity: severityList(s.severity),
    category: csvToArray(s.category),
    actor: s.actor ?? "",
    q: s.q ?? "",
    from: window.from,
    to: window.to,
    source: "",
    status: "",
    ip: s.ip ?? "",
    resource: s.resource ?? "",
  };
}
