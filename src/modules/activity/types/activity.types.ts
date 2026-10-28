// Wire types of the backend's /v1/activity API; keep them in sync with it.

export type Severity = "info" | "success" | "warning" | "error" | "critical";

/** Outcome bucket over severity, matching the summary's by_outcome keys. */
export type Outcome = "success" | "warning" | "failed" | "info";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected" | "paused";

export interface ActivityEvent {
  id: string;
  type: string;
  category: string;
  severity: Severity;
  title: string;
  description?: string;
  actor?: { id?: string; name?: string; type?: string };
  target?: { type?: string; id?: string; label?: string };
  at: string; // RFC 3339 timestamp
  source?: string;
  ip?: string;
  location?: string;
  device?: string;
  browser?: string;
  status?: string;
  request_id?: string; // Id of the originating request, which correlates related events
  metadata?: Record<string, unknown>;
}

/** Aggregate snapshot from GET /v1/activity/summary. */
export interface ActivitySummary {
  total: number;
  unique_actors: number;
  security_alerts: number;
  by_severity: Record<string, number>;
  by_category: Record<string, number>;
  by_outcome: Record<string, number>;
  series: ActivitySummaryBucket[];
  bucket_seconds: number;
  window: { from: string; to: string };
}

/** One sparkline time slice: total plus per-outcome/severity breakdowns. */
export interface ActivitySummaryBucket {
  at: string;
  count: number;
  success: number;
  warning: number;
  failed: number;
  info: number;
  critical: number;
}

/** Response from GET /v1/activity/{id}/related. */
export interface RelatedEventsResponse {
  event: ActivityEvent;
  related: {
    by_request_id: ActivityEvent[];
    by_actor: ActivityEvent[];
  };
}

export interface ActivityFilters {
  types: string[];
  severity: Severity[];
  category: string[];
  actor: string;
  q: string;
  from: string;
  to: string;
  source: string;
  status: string;
  ip: string; // Exact IP match; the server ignores it, so it applies only to loaded events
  resource: string; // Exact `target.type` match, applied only to loaded events
}

export const DEFAULT_FILTERS: ActivityFilters = {
  types: [],
  severity: [],
  category: [],
  actor: "",
  q: "",
  from: "",
  to: "",
  source: "",
  status: "",
  ip: "",
  resource: "",
};

export type DateBucket = "today" | "yesterday" | "thisWeek" | "lastWeek" | "lastMonth" | "older";

export interface DateGroup {
  key: DateBucket; // labelled `activity:dateGroup.<key>`
  events: ActivityEvent[];
}
