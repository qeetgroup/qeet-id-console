// One correlation id per logical api() request, sent as X-Request-Id and echoed into logs, so a
// console error can be tied to the backend's request_id on audit and activity events.
export function newRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    // Falls through to the timestamp id.
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
