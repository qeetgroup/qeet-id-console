import { newRequestId } from "@/platform/telemetry/tracing";
import { readServerSession } from "@/platform/auth/server-session";
import { getServerApiBaseUrl } from "@/platform/api/server-proxy";

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

async function proxyAuthenticatedStream({ path, method, request }: StreamProxyOptions) {
  const session = await readServerSession();
  if (!session.accessToken || !session.refreshToken) {
    return errorResponse(401, "auth.session_required", "Sign in to continue.");
  }

  const requestId = request.headers.get("x-request-id") ?? newRequestId();
  const body = method === "POST" ? await request.text() : undefined;

  const forward = (accessToken: string) => {
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      Authorization: `Bearer ${accessToken}`,
      "Cache-Control": "no-cache",
      "X-Request-Id": requestId,
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

  const response = await forward(session.accessToken);

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
