// The browser's only request path. The same-origin BFF attaches the token from the encrypted
// HttpOnly cookie, refreshes once on a 401 and returns only safe session metadata; failures
// become a typed ApiError. Request ids and schema checks added here reach every caller.
import type { ZodType } from "zod";

import { onAuthLost } from "@/platform/auth/auth-lost";
import { sessionStore } from "@/platform/auth/session-store";
import {
  clearServerSession,
  proxyApiRequest,
  refreshServerSessionNow,
} from "@/platform/api/server-proxy";
import { ApiError, type ApiFieldError } from "@/platform/errors/api-error";
import { ERROR_CODES } from "@/platform/errors/error-codes";
import { requestStepUp } from "@/platform/security/step-up-gate";
import { newRequestId } from "@/platform/telemetry/tracing";

// Re-exported so callers get the request essentials from one module.
export { sessionStore } from "@/platform/auth/session-store";
export { getApiBaseUrl } from "@/platform/config/api-base-url";
export { ApiError } from "@/platform/errors/api-error";

type RequestOpts<T = unknown> = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  anonymous?: boolean; // no session token, for public endpoints such as sign-up
  schema?: ZodType<T>; // checks the response, throwing ApiError on a mismatch
  afterStepUp?: boolean; // internal: the one retry after a step-up
};

type ErrorEnvelope = {
  code?: string;
  message?: string;
  detail?: string;
  retryable?: boolean;
  metadata?: Record<string, unknown>;
  request_id?: string;
  fields?: unknown;
};

// Keeps each field's name and code; the backend's per-field message is never shown.
function fieldErrorsOf(fields: unknown): ApiFieldError[] {
  if (!Array.isArray(fields)) return [];
  return fields.flatMap((f) =>
    f && typeof f.field === "string" && typeof f.code === "string"
      ? [{ field: f.field, code: f.code }]
      : [],
  );
}

let localRefresh: Promise<void> | null = null;

function needsRefresh(): boolean {
  const session = sessionStore.getSnapshot();
  if (!session.isAuthenticated || !session.expiresAt) return false;
  const expiresAt = Date.parse(session.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now() + 60_000;
}

function isRefreshUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.code === ERROR_CODES.SESSION_REFRESH_UNAVAILABLE;
}

/**
 * Renews the session when it is near expiry, or always with `force`, and resolves false only
 * when the session is gone. Throws a retryable `client.session_refresh_unavailable` ApiError
 * when Qeet ID can't be reached: the refresh token wasn't rejected, so the person stays signed in.
 */
export async function refreshSessionForRequest(
  signal?: AbortSignal,
  force = false,
): Promise<boolean> {
  // On the server, proxyApiRequest has already renewed the session for a 401,
  // so a forced refresh has nothing left to try.
  if (typeof window === "undefined") return !force;
  if (!force && !needsRefresh()) return true;

  const refresh = async () => {
    const expectedVersion = sessionStore.getSnapshot().version;
    const { session, unavailable } = await refreshServerSessionNow({
      data: { expectedVersion, force },
      signal,
    });
    if (unavailable) {
      throw new ApiError(
        503,
        ERROR_CODES.SESSION_REFRESH_UNAVAILABLE,
        "The session could not be renewed right now.",
        undefined,
        true,
      );
    }
    sessionStore.set(session);
    return session.isAuthenticated;
  };

  if (navigator.locks) {
    return navigator.locks.request(
      "qeetid-session-refresh",
      { mode: "exclusive", signal },
      refresh,
    );
  }

  if (!localRefresh) {
    localRefresh = refresh()
      .then((authenticated) => {
        if (!authenticated) throw new ApiError(401, "auth.session_expired", "Session expired");
      })
      .finally(() => {
        localRefresh = null;
      });
  }
  try {
    await localRefresh;
    return sessionStore.getSnapshot().isAuthenticated;
  } catch (error) {
    if (isRefreshUnavailable(error)) throw error;
    return false;
  }
}

export async function clearBrowserSession() {
  await clearServerSession().catch(() => undefined);
  onAuthLost();
}

export async function api<T = unknown>(path: string, opts: RequestOpts<T> = {}): Promise<T> {
  const { method = "GET", body, query, signal, anonymous = false, schema } = opts;
  const requestScopeGeneration = sessionStore.getScopeGeneration();
  if (!anonymous && !(await refreshSessionForRequest(signal))) {
    await clearBrowserSession();
    throw new ApiError(401, "auth.session_expired", "Your session has expired.");
  }
  const serializedQuery: Record<string, string | number> = {};
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") serializedQuery[k] = v;
    }
  }

  const requestId = newRequestId();
  let res = await proxyApiRequest({
    data: {
      path: path.startsWith("/") ? path : `/${path}`,
      method,
      body,
      query: serializedQuery,
      anonymous,
      requestId,
    },
    signal,
  });
  if (res.status === 401 && !anonymous && (await refreshSessionForRequest(signal, true))) {
    res = await proxyApiRequest({
      data: {
        path: path.startsWith("/") ? path : `/${path}`,
        method,
        body,
        query: serializedQuery,
        anonymous,
        requestId,
      },
      signal,
    });
  }
  if (requestScopeGeneration !== sessionStore.getScopeGeneration()) {
    throw new ApiError(
      0,
      "client.stale_scope",
      "This response belongs to a previous session scope.",
    );
  }
  sessionStore.set(res.session, { broadcast: res.sessionChanged });

  if (res.status === 204) return undefined as T;
  const data = res.data;

  if (res.status < 200 || res.status >= 300) {
    const err = (data as { error?: ErrorEnvelope } | null)?.error;
    const apiError = new ApiError(
      res.status,
      err?.code ?? `http_${res.status}`,
      err?.message ?? "Request failed",
      err?.detail,
      err?.retryable ?? false,
      err?.metadata,
      { requestId: err?.request_id || requestId, fields: fieldErrorsOf(err?.fields) },
    );
    if (res.status === 401 && !anonymous) await clearBrowserSession();
    // A sensitive action refused for want of a step-up: ask for one, then send
    // the same request once more. It never ran, so the retry is safe.
    if (
      apiError.code === "step_up_required" &&
      !opts.afterStepUp &&
      (await requestStepUp(apiError))
    ) {
      return api<T>(path, { ...opts, afterStepUp: true });
    }
    throw apiError;
  }

  // A mismatch means the backend contract drifted: fail closed rather than hand the UI bad data.
  if (schema) {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new ApiError(
        0,
        "client.schema_mismatch",
        "The server returned an unexpected response.",
        parsed.error.message,
        false,
        undefined,
        { requestId },
      );
    }
    return parsed.data;
  }

  return data as T;
}
