// The production log lines for the BFF's backend calls: a path's template, never its query, a
// body or a token. Called only from server-function handlers, so it stays out of the browser.
import { pathTemplate } from "@/platform/telemetry/path-template";
import { serverLog } from "@/platform/telemetry/server-log";

/** What became of a proxied call. */
export type ProxyOutcome =
  | "ok"
  | "refreshed"
  | "refresh_rejected"
  | "backend_unavailable"
  | "session_ended"
  | "unexpected_token";

type ProxiedCall = {
  requestId: string;
  method: string;
  pathname: string; // the backend path; only its template is logged
  status: number | null; // null when the backend never answered
  outcome: ProxyOutcome;
  startedAt: number;
};

/** Logs one proxied backend call: `error` when the backend failed or never answered. */
export function logProxiedCall(call: ProxiedCall): void {
  const failed = call.status === null || call.status >= 500 || call.outcome === "unexpected_token";
  serverLog(failed ? "error" : "info", "api.request", {
    requestId: call.requestId,
    method: call.method,
    path: pathTemplate(call.pathname),
    status: call.status,
    durationMs: Date.now() - call.startedAt,
    outcome: call.outcome,
  });
}

/** Logs a session renewal: a rejected refresh token signs the person out. */
export function logSessionRefresh(
  requestId: string,
  outcome: "refreshed" | "rejected" | "unavailable",
  trigger: "backend_401" | "browser_expiring" | "browser_forced",
  startedAt: number,
): void {
  const level = outcome === "refreshed" ? "info" : outcome === "rejected" ? "warn" : "error";
  serverLog(level, "session.refresh", {
    requestId,
    trigger,
    outcome,
    durationMs: Date.now() - startedAt,
  });
}
