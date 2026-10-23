// The browser's one path for server-sent events: the same-origin BFF stream routes in
// server-stream.ts, which attach the token server-side. A 401 renews the session and resends once,
// as api() does, and every refusal becomes a typed ApiError.
import { clearBrowserSession, refreshSessionForRequest } from "@/platform/api/client";
import { sessionStore } from "@/platform/auth/session-store";
import { ApiError } from "@/platform/errors/api-error";
import { ERROR_CODES } from "@/platform/errors/error-codes";
import { newRequestId } from "@/platform/telemetry/tracing";

export type StreamRoute = "/api/activity-stream" | "/api/qeetai-stream";

export type EventStreamRequest = {
  method?: "GET" | "POST";
  query?: Record<string, string>;
  body?: unknown; // sent as JSON
  lastEventId?: string | null; // resumes a dropped stream after this event
  signal: AbortSignal;
};

/** One dispatched server-sent event. */
export type ServerSentEvent = {
  event: string; // the `event:` field, or "message"
  data: string; // the `data:` lines joined by "\n"
  id?: string; // the last `id:` seen on the stream, for resuming
};

type ErrorEnvelope = {
  error?: { code?: string; detail?: string; retryable?: boolean; request_id?: string };
};

async function refusal(res: Response, requestId: string): Promise<ApiError> {
  let envelope: ErrorEnvelope["error"];
  try {
    envelope = ((await res.json()) as ErrorEnvelope).error;
  } catch {
    // Not JSON: the status alone classifies it.
  }
  return new ApiError(
    res.status,
    envelope?.code ?? `http_${res.status}`,
    "Stream request failed",
    envelope?.detail,
    envelope?.retryable ?? false,
    undefined,
    { requestId: envelope?.request_id || requestId },
  );
}

/**
 * Opens a BFF stream route and returns its event body. Throws an ApiError when the stream is
 * refused, signing the person out first when their session is gone, and rethrows a network
 * failure or abort as is.
 */
export async function openEventStream(
  route: StreamRoute,
  request: EventStreamRequest,
): Promise<ReadableStream<Uint8Array>> {
  const { method = "GET", query, body, lastEventId, signal } = request;
  const scopeGeneration = sessionStore.getScopeGeneration();
  const url = new URL(route, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);

  const requestId = newRequestId();
  const send = () => {
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Request-Id": requestId,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (lastEventId) headers["Last-Event-ID"] = lastEventId;
    return fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  };

  let res = await send();
  if (res.status === 401) {
    await res.body?.cancel().catch(() => undefined);
    if (await refreshSessionForRequest(signal, true)) res = await send();
  }
  if (scopeGeneration !== sessionStore.getScopeGeneration()) {
    await res.body?.cancel().catch(() => undefined);
    throw new ApiError(0, "client.stale_scope", "This stream belongs to a previous session scope.");
  }
  if (res.status === 401) {
    await res.body?.cancel().catch(() => undefined);
    await clearBrowserSession();
    throw new ApiError(
      401,
      ERROR_CODES.SESSION_EXPIRED,
      "Your session has expired.",
      undefined,
      false,
      undefined,
      { requestId },
    );
  }
  if (!res.ok || !res.body) throw await refusal(res, requestId);
  return res.body;
}

/**
 * Yields each event of a server-sent event body, parsed as the HTML standard specifies: any line
 * ending, comments skipped, multi-line data joined, and an event cut off by the end discarded.
 * Stopping the iteration cancels the body.
 */
export async function* readServerSentEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ServerSentEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let event = "";
  let data: string[] = [];
  let id: string | undefined;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      // A trailing \r may be the first half of a \r\n split across chunks.
      const end = !done && pending.endsWith("\r") ? pending.length - 1 : pending.length;
      const lines = pending.slice(0, end).split(/\r\n|\r|\n/);
      pending = (lines.pop() ?? "") + pending.slice(end);

      for (const line of lines) {
        if (line === "") {
          if (data.length > 0) yield { event: event || "message", data: data.join("\n"), id };
          event = "";
          data = [];
          continue;
        }
        const colon = line.indexOf(":");
        if (colon === 0) continue; // a comment, such as a keep-alive
        const field = colon === -1 ? line : line.slice(0, colon);
        let fieldValue = colon === -1 ? "" : line.slice(colon + 1);
        if (fieldValue.startsWith(" ")) fieldValue = fieldValue.slice(1);
        if (field === "event") event = fieldValue;
        else if (field === "data") data.push(fieldValue);
        else if (field === "id" && !fieldValue.includes("\0")) id = fieldValue;
      }
      if (done) return;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
