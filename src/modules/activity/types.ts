// Shared contract types for the Enterprise Live Activity Center.
// Must be kept in sync with the backend's /v1/activity API.

export type Severity = "info" | "success" | "warning" | "error" | "critical";

/** Coarse outcome bucket — a friendly grouping over severity, mirrors the
 *  backend summary's by_outcome. success | warning | failed | info. */
export type Outcome = "success" | "warning" | "failed" | "info";

/** Whether the feed streams live SSE events or shows a pinned historical window. */
export type ActivityMode = "live" | "history";

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
  /** RFC3339 timestamp */
  at: string;
  source?: string;
  ip?: string;
  location?: string;
  device?: string;
  browser?: string;
  status?: string;
  /** Correlation ID of the originating request; drives related-events + copy. */
  request_id?: string;
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
  /** Exact IP match. Applied client-side over loaded events (no server column). */
  ip: string;
  /** Exact resource-type match (event.target.type). Applied client-side. */
  resource: string;
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

export interface DateGroup {
  label: string;
  events: ActivityEvent[];
}
