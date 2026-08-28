// The single browser request path to the same-origin TanStack Start BFF.
// Access and refresh tokens remain in an encrypted HttpOnly cookie; the BFF
// attaches the Bearer token, refreshes once on 401, and returns only safe
// session metadata to the browser.
// - Normalises failures into a typed `ApiError` (platform/errors/api-error).
//
// This is the ONE place requests leave the app; cross-cutting concerns
// (correlation ids, opt-in runtime schema parsing, telemetry) are added here so
// every caller inherits them without change.
import type { ZodType } from "zod";

import { onAuthLost } from "@/platform/auth/auth-lost";
import { sessionStore } from "@/platform/auth/session-store";
import {
  clearServerSession,
  proxyApiRequest,
  refreshServerSessionNow,
} from "@/platform/api/server-proxy";
import { ApiError } from "@/platform/errors/api-error";
import { newRequestId } from "@/platform/telemetry/tracing";

// Convenience re-exports so callers can import the request essentials from one
// module (mirrors the old single-module ergonomics). Canonical homes remain
// @/platform/errors, @/platform/config, and @/platform/auth.
export { sessionStore } from "@/platform/auth/session-store";
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

let localRefresh: Promise<void> | null = null;

function needsRefresh(): boolean {
  const session = sessionStore.getSnapshot();
  if (!session.isAuthenticated || !session.expiresAt) return false;
  const expiresAt = Date.parse(session.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now() + 60_000;
}

export async function refreshSessionForRequest(
  signal?: AbortSignal,
  force = false,
): Promise<boolean> {
  if ((!force && !needsRefresh()) || typeof window === "undefined") return true;

  const refresh = async () => {
    const expectedVersion = sessionStore.getSnapshot().version;
    const session = await refreshServerSessionNow({
      data: { expectedVersion, force },
      signal,
    });
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
  } catch {
    return false;
  }
}

export async function clearBrowserSession() {
  await clearServerSession().catch(() => undefined);
  onAuthLost();
}

export async function api<T = unknown>(path: string, opts: RequestOpts<T> = {}): Promise<T> {
  const { method = "GET", body, query, signal, anonymous = false, schema } = opts;
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
  sessionStore.set(res.session, { broadcast: res.sessionChanged });

  if (res.status === 204) return undefined as T;
  const data = res.data;

  if (res.status < 200 || res.status >= 300) {
    const err = (
      data as {
        error?: { code?: string; message?: string; detail?: string; retryable?: boolean };
      } | null
    )?.error;
    const apiError = new ApiError(
      res.status,
      err?.code ?? `http_${res.status}`,
      err?.message ?? "Request failed",
      err?.detail,
      err?.retryable ?? false,
    );
    if (res.status === 401 && !anonymous) await clearBrowserSession();
    throw apiError;
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
