// URL search params for the Activity workspace, the source of truth for its filters, mode,
// saved view and open event, so any view is shareable as a link.

import { type DateRange, presetToRange, TIME_PRESETS } from "./components/activity-time-range";
import type { ActivityFilters, ActivityMode, Outcome, Severity } from "./types/activity.types";

export type DrawerTab = "overview" | "raw" | "related";

/**
 * Activity URL params. severity, category and type are comma-separated lists; `range` is a
 * TIME_PRESETS key, with RFC 3339 `from`/`to` used only when it is "custom"; `view` is the
 * applied saved view; `event` opens that event's drawer on `tab`.
 */
export interface ActivitySearch {
  q?: string;
  severity?: string;
  category?: string;
  type?: string;
  actor?: string;
  ip?: string;
  resource?: string;
  source?: string;
  status?: string;
  range?: string;
  from?: string;
  to?: string;
  mode?: ActivityMode;
  view?: string;
  event?: string;
  tab?: DrawerTab;
}

const SEVERITIES: Severity[] = ["info", "success", "warning", "error", "critical"];
const RANGE_KEYS = new Set(TIME_PRESETS.map((p) => p.value));
const MODES = new Set<ActivityMode>(["live", "history"]);
const TABS = new Set<DrawerTab>(["overview", "raw", "related"]);

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

/** Validates raw route search params: blanks and unknown enum values become undefined. */
export function validateActivitySearch(raw: Record<string, unknown>): ActivitySearch {
  const str = (k: string): string | undefined => {
    const v = raw[k];
    return typeof v === "string" && v.trim() !== "" ? v : undefined;
  };
  const range = str("range");
  const mode = str("mode");
  const tab = str("tab");
  return {
    q: str("q"),
    severity: str("severity"),
    category: str("category"),
    type: str("type"),
    actor: str("actor"),
    ip: str("ip"),
    resource: str("resource"),
    source: str("source"),
    status: str("status"),
    range: range && RANGE_KEYS.has(range) ? range : undefined,
    from: str("from"),
    to: str("to"),
    mode: mode && MODES.has(mode as ActivityMode) ? (mode as ActivityMode) : undefined,
    view: str("view"),
    event: str("event"),
    tab: tab && TABS.has(tab as DrawerTab) ? (tab as DrawerTab) : undefined,
  };
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
