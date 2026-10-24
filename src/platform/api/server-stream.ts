import { newRequestId } from "@/platform/telemetry/tracing";
import { pathTemplate } from "@/platform/telemetry/path-template";
import { serverLog } from "@/platform/telemetry/server-log";
import { readServerSession } from "@/platform/auth/server-session";
import { getServerApiBaseUrl, isSessionEnded } from "@/platform/api/server-proxy";
import { getRequestIP } from "@tanstack/react-start/server";
import { relayHeaders } from "@/platform/api/relay";

const QEETAI_STREAM_PATH = /^\/v1\/qeetai\/conversations\/[0-9a-f-]{36}\/messages$/i;

type StreamProxyOptions = {
  path: string;
  method: "GET" | "POST";
  request: Request;
};

function errorResponse(status: number, code: string, message: string) {
  return Response.json(
    { error: { code, message, retryable: false } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

type StreamOutcome = "ok" | "no_session" | "aborted" | "backend_unavailable" | "session_ended";

async function proxyAuthenticatedStream({ path, method, request }: StreamProxyOptions) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-request-id") ?? newRequestId();
  // One production log line per stream, when the backend answers: its lifetime isn't known then.
  const log = (status: number | null, outcome: StreamOutcome) => {
    const failed = outcome === "backend_unavailable" || (status ?? 0) >= 500;
    serverLog(failed ? "error" : "info", "api.stream", {
      requestId: requestId.slice(0, 200), // the browser's header, so bounded
      method,
      path: pathTemplate(path),
      status,
      durationMs: Date.now() - startedAt,
      outcome,
    });
  };

  const session = await readServerSession();
  if (!session.accessToken || !session.refreshToken) {
    log(401, "no_session");
    return errorResponse(401, "auth.session_required", "Sign in to continue.");
  }

  const body = method === "POST" ? await request.text() : undefined;

  const forward = (accessToken: string) => {
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      Authorization: `Bearer ${accessToken}`,
      "Cache-Control": "no-cache",
      "X-Request-Id": requestId,
      ...relayHeaders(request, getRequestIP()),
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const lastEventId = request.headers.get("last-event-id");
    if (lastEventId) headers["Last-Event-ID"] = lastEventId;
    const userAgent = request.headers.get("user-agent");
    if (userAgent) headers["User-Agent"] = userAgent;

    return fetch(new URL(path.slice(1), `${getServerApiBaseUrl()}/`), {
      method,
      headers,
      body,
      signal: request.signal,
    });
  };

  let response: Response;
  try {
    response = await forward(session.accessToken);
  } catch (error) {
    log(null, request.signal.aborted ? "aborted" : "backend_unavailable");
    throw error;
  }
  log(response.status, (await isSessionEnded(response)) ? "session_ended" : "ok");

  const headers = new Headers({
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no",
    "X-Request-Id": response.headers.get("x-request-id") ?? requestId,
  });
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function proxyActivityStream(request: Request) {
  return proxyAuthenticatedStream({
    path: "/v1/activity/stream",
    method: "GET",
    request,
  });
}

export function proxyQeetAIStream(request: Request) {
  const path = new URL(request.url).searchParams.get("path");
  if (!path || !QEETAI_STREAM_PATH.test(path)) {
    return errorResponse(400, "client.invalid_stream_path", "The stream path is invalid.");
  }
  return proxyAuthenticatedStream({ path, method: "POST", request });
}
