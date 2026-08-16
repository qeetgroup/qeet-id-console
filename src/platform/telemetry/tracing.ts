// Correlation ids. One per logical api() request, attached as X-Request-Id and
// echoed into logs/captureError so a console error can be tied to the backend's
// request_id/correlation_id on audit/activity events.
export function newRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
