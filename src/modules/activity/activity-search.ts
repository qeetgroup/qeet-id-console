// URL search-param schema for the Activity workspace — the single source of
// truth for filters, time range, live/history mode, the applied saved view, and
// the selected event + drawer tab. Mirrors the audit-logs `validateSearch`
// pattern so any view is paste-shareable (e.g. Slack triage links) and a
// malformed URL never crashes the route.
//
// Note on time: relative presets (24h, 7d…) are resolved to concrete from/to
// via presetToRange. searchToFilters is only called inside a useMemo keyed on
// the router search object, so `now` is captured once per navigation — the
// window is frozen at selection time (it does not slide every render, which
// would thrash the query cache).

import { type DateRange, presetToRange, TIME_PRESETS } from "./components/activity-time-range";
import type { ActivityFilters, ActivityMode, Outcome, Severity } from "./types/activity.types";

export type DrawerTab = "overview" | "raw" | "related";

export interface ActivitySearch {
  q?: string;
  severity?: string; // csv, e.g. "error,critical"
  category?: string; // csv
  type?: string; // csv of event types
  actor?: string;
  ip?: string;
  resource?: string;
  source?: string;
  status?: string;
  range?: string; // preset key: all|15m|1h|24h|7d|30d|custom
  from?: string; // RFC3339, only when range=custom
  to?: string;
  mode?: ActivityMode; // live | history (default live)
  view?: string; // applied saved-view id
  event?: string; // selected event id → opens drawer
  tab?: DrawerTab; // active drawer tab
}

const SEVERITIES: Severity[] = ["info", "success", "warning", "error", "critical"];
const RANGE_KEYS = new Set(TIME_PRESETS.map((p) => p.value));
const MODES = new Set<ActivityMode>(["live", "history"]);
const TABS = new Set<DrawerTab>(["overview", "raw", "related"]);

/** Outcome is a friendly grouping over severity (mirrors the summary's by_outcome). */
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

/** Route validateSearch — every field optional; enums clamped; blanks dropped. */
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

/** Resolves the URL search into the ActivityFilters the provider/query consume. */
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
