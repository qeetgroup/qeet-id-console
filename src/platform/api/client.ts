// The single HTTP request path to the qeet-id Go backend.
// - Attaches the Bearer access token (from platform/auth/token-store).
// - On 401, tries `/v1/auth/refresh` once (single-flight, shared across a wave
//   of concurrent queries) and replays the original request. If refresh fails,
//   clears local state and hard-redirects to /sign-in (see platform/auth/refresh).
// - Normalises failures into a typed `ApiError` (platform/errors/api-error).
//
// This is the ONE place requests leave the app; cross-cutting concerns
// (correlation ids, opt-in runtime schema parsing, telemetry) are added here so
// every caller inherits them without change.
import type { ZodType } from "zod";

import { onAuthLost, refreshAccessToken } from "@/platform/auth/refresh";
import { tokenStore } from "@/platform/auth/token-store";
import { API_BASE_URL } from "@/platform/config/api-base-url";
import { ApiError } from "@/platform/errors/api-error";
import { newRequestId } from "@/platform/telemetry/tracing";

// Convenience re-exports so callers can import the request essentials from one
// module (mirrors the old single-module ergonomics). Canonical homes remain
// @/platform/errors, @/platform/config, and @/platform/auth.
export { tokenStore } from "@/platform/auth/token-store";
export { API_BASE_URL } from "@/platform/config/api-base-url";
export { ApiError } from "@/platform/errors/api-error";

type RequestOpts<T = unknown> = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  /** Skip the auth header (used for public endpoints like signup/login). */
  anonymous?: boolean;
  /**
   * Optional runtime schema. When provided, the JSON response is parsed with it
   * and the inferred type is returned; a mismatch throws an ApiError so it
   * surfaces like any other failure. Opt-in — omit to keep the raw `T` cast.
   * Adopt for security-sensitive endpoints first (effective-permissions,
   * refresh, MFA, signing keys, OAuth clients).
   */
  schema?: ZodType<T>;
};

async function doFetch(
  url: URL,
  method: string,
  body: unknown,
  signal: AbortSignal | undefined,
  anonymous: boolean,
  requestId: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    // Correlation id echoed into logs; ties a console action to the backend's
    // request_id/correlation_id on audit/activity events.
    "X-Request-Id": requestId,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (!anonymous) {
    const tok = tokenStore.get();
    if (tok) headers.Authorization = `Bearer ${tok}`;
  }
  return fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
}

export async function api<T = unknown>(path: string, opts: RequestOpts<T> = {}): Promise<T> {
  const { method = "GET", body, query, signal, anonymous = false, schema } = opts;

  const url = new URL(path.startsWith("/") ? path.slice(1) : path, `${API_BASE_URL}/`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  // One id per logical request, shared across the refresh replay for correlation.
  const requestId = newRequestId();
  let res = await doFetch(url, method, body, signal, anonymous, requestId);

  // Authenticated 401 → try to refresh once, then replay. Skip the retry for
  // the refresh endpoint itself (avoids infinite loop) and for explicitly
  // anonymous calls (login/signup form errors should surface immediately).
  if (res.status === 401 && !anonymous && !path.includes("/auth/refresh")) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      res = await doFetch(url, method, body, signal, anonymous, requestId);
    } else {
      onAuthLost();
    }
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? safeParse(text) : null;

  if (!res.ok) {
    const err = (
      data as {
        error?: { code?: string; message?: string; detail?: string; retryable?: boolean };
      } | null
    )?.error;
    throw new ApiError(
      res.status,
      err?.code ?? `http_${res.status}`,
      err?.message ?? res.statusText ?? "Request failed",
      err?.detail,
      err?.retryable ?? false,
    );
  }

  // Opt-in runtime validation. A mismatch means the backend contract drifted —
  // fail closed with an ApiError instead of handing garbage to the UI.
  if (schema) {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new ApiError(
        0,
        "client.schema_mismatch",
        "The server returned an unexpected response.",
        parsed.error.message,
        false,
      );
    }
    return parsed.data;
  }

  return data as T;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
