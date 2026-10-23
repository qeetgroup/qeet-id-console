import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestIP, getResponse } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  type PublicSession,
  clearServerSessionCookie,
  readServerSession,
  type ServerSessionData,
  toPublicSession,
  openServerSession,
} from "@/platform/auth/server-session";
import {
  isBackendTokenResponse,
  isSessionIssuingRequest,
  type JsonValue,
  serverSessionData,
  stripBackendTokens,
} from "@/platform/auth/session-response";
import {
  buildBackendUrl,
  isGlobalSignOutRequest,
  isLocalSessionDestroyRequest,
} from "@/platform/api/server-request-policy";
import { relayHeaders } from "@/platform/api/relay";
import { ERROR_CODES } from "@/platform/errors/error-codes";
import { logger } from "@/platform/telemetry/logger";
import {
  requiresOrganizationSelection,
  signInRequiresOrganizationSelection,
} from "@/platform/auth/organization-selection";

const requestSchema = z.object({
  path: z
    .string()
    .min(1)
    .refine(
      (path) =>
        path.startsWith("/") &&
        !path.startsWith("//") &&
        // Mirrors FORBIDDEN_PATH_CHARACTERS in server-request-policy.ts.
        // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
        !/[\\?#\u0000-\u001f\u007f]/.test(path) &&
        !path.includes("://"),
      "Invalid API path",
    ),
  method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]),
  body: z.unknown().optional(),
  query: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  anonymous: z.boolean(),
  requestId: z.string().min(1).max(200),
});

export type ServerProxyResponse = {
  status: number;
  data: JsonValue;
  session: PublicSession;
  sessionChanged: boolean;
};

/**
 * - `refreshed`: new tokens are in the session.
 * - `rejected`: the backend refused the refresh token; the session is cleared.
 * - `unavailable`: the backend couldn't answer (timeout, network, 5xx, 429). The
 *   token wasn't judged, so the session is kept and the caller may retry.
 */
export type RefreshOutcome = "refreshed" | "rejected" | "unavailable";

export type SessionRefreshResult = {
  session: PublicSession;
  unavailable: boolean; // no verdict was reached; the session is unchanged
};

// Upper bounds on backend calls, so a hung upstream fails the request instead
// of holding the server function open. Streams are excluded (long-lived).
const BACKEND_TIMEOUT_MS = 30_000;
const AUTH_CALL_TIMEOUT_MS = 10_000;

// relayed names the person's address to the API (see relay.ts).
function relayed(): Record<string, string> {
  return relayHeaders(getRequest(), getRequestIP());
}

function preventSharedCaching() {
  const headers = getResponse().headers;
  headers.set("Cache-Control", "no-store");
  headers.set("Vary", "Cookie");
}

export function getServerApiBaseUrl(): string {
  const configured = process.env.SERVER_URL ?? process.env.VITE_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:4001";
  throw new Error("SERVER_URL must be configured in production.");
}

async function parseResponse(response: Response): Promise<JsonValue> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return text;
  }
}

/**
 * True for a 401 saying the backend ended the session (signed out everywhere, suspended, removed,
 * password reset): no refresh can renew it.
 */
export async function isSessionEnded(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  const data = await parseResponse(response.clone()).catch(() => null);
  const error = data && typeof data === "object" && !Array.isArray(data) ? data.error : null;
  return (
    !!error &&
    typeof error === "object" &&
    !Array.isArray(error) &&
    error.code === ERROR_CODES.SESSION_REVOKED
  );
}

// Concurrent refreshes that spend the same refresh token share one backend call. A later request
// still carrying a rotated token (one aborted mid-refresh never got its new cookie) gets the same
// pair from the backend's reuse grace. `relay` comes from the caller: this function is exported,
// so it reaches the client bundle and can't read the request itself.
async function refreshSession(
  session: Awaited<ReturnType<typeof openServerSession>>,
  requestId: string,
  relay: Record<string, string> = {},
): Promise<RefreshOutcome> {
  const refreshToken = session.data.refreshToken;
  if (!refreshToken) return "rejected";
  let flight = refreshFlights.get(refreshToken);
  if (!flight) {
    flight = (async (): Promise<RefreshResult> => {
      let response: Response;
      let data: JsonValue;
      try {
        response = await fetch(`${getServerApiBaseUrl()}/v1/auth/refresh`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
            ...relay,
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
          signal: AbortSignal.timeout(AUTH_CALL_TIMEOUT_MS),
        });
        data = await parseResponse(response);
      } catch {
        return "unavailable";
      }
      // Only a definite answer about the token ends the session: an overloaded
      // or failing backend (5xx, 429) hasn't judged it.
      if (response.status >= 500 || response.status === 429) return "unavailable";
      return response.ok && isBackendTokenResponse(data) ? serverSessionData(data) : "rejected";
    })();
    refreshFlights.set(refreshToken, flight);
    const settled = flight;
    void settled.finally(() => {
      if (refreshFlights.get(refreshToken) === settled) refreshFlights.delete(refreshToken);
    });
  }
  const refreshed = await flight;
  if (refreshed === "unavailable") return "unavailable";
  if (refreshed === "rejected") {
    await session.clear();
    return "rejected";
  }
  await session.update({
    ...refreshed,
    organizationSelectionRequired: session.data.organizationSelectionRequired === true,
    version: (session.data.version ?? 0) + 1,
  });
  return "refreshed";
}

type RefreshResult = ServerSessionData | "rejected" | "unavailable";

const refreshFlights = new Map<string, Promise<RefreshResult>>(); // in flight, by the token spent

/** Forgets every refresh in flight; for tests. */
export function _resetRefreshFlightsForTest() {
  refreshFlights.clear();
}

export const refreshServerSession = refreshSession;

async function forwardRequest(
  input: z.infer<typeof requestSchema>,
  url: URL,
  accessToken?: string,
): Promise<Response> {
  const incoming = getRequest();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Request-Id": input.requestId,
    ...relayed(),
  };
  if (input.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const userAgent = incoming.headers.get("user-agent");
  if (userAgent) headers["User-Agent"] = userAgent;

  return fetch(url, {
    method: input.method,
    headers,
    body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
    signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
  });
}

// Dev-only trace of the upstream call, which the browser's Network tab can't see. Bodies go in
// the context argument, which `logger` redacts (the message isn't); the query string is left out
// as it can carry one-time tokens under unknown keys. `logger` no-ops in production.
function traceBackendCall(
  method: string,
  pathname: string,
  status: number | "ERR",
  elapsedMs: number,
  requestId: string,
  bodies?: { request?: unknown; response?: unknown },
): void {
  logger.debug(
    `api → ${method} ${pathname} ${status} (${elapsedMs}ms) req=${requestId}`,
    bodies ? { request: bodies.request ?? null, response: bodies.response ?? null } : undefined,
  );
}

export const proxyApiRequest = createServerFn({ method: "POST" })
  .validator(requestSchema)
  .handler(async ({ data: input }): Promise<ServerProxyResponse> => {
    preventSharedCaching();

    let sessionData = await readServerSession();
    const target = buildBackendUrl(getServerApiBaseUrl(), input.path, input.query);
    const pathname = target.pathname;
    const destroysLocalSession = isLocalSessionDestroyRequest(pathname, input.method);
    let response: Response;
    let sessionChanged = false;
    const startedAt = Date.now();
    try {
      response = await forwardRequest(
        input,
        target,
        input.anonymous ? undefined : sessionData.accessToken,
      );
      // The BFF holds the refresh token, so it renews the session here, for server renders too,
      // and retries once: a refused request never ran. Only a rejected refresh token ends the
      // session; an unreachable backend leaves it intact. An ended session isn't renewed.
      if (
        response.status === 401 &&
        !input.anonymous &&
        sessionData.refreshToken &&
        !destroysLocalSession &&
        !(await isSessionEnded(response))
      ) {
        const session = await openServerSession();
        const outcome = await refreshServerSession(session, input.requestId, relayed());
        if (outcome === "unavailable") {
          return {
            status: 503,
            data: {
              error: {
                code: ERROR_CODES.SESSION_REFRESH_UNAVAILABLE,
                message: "The session could not be renewed right now.",
                retryable: true,
              },
            },
            session: toPublicSession(sessionData),
            sessionChanged: false,
          };
        }
        sessionData = outcome === "refreshed" ? session.data : {};
        sessionChanged = true;
        if (outcome === "refreshed") {
          response = await forwardRequest(input, target, sessionData.accessToken);
        }
      }
    } catch (error) {
      traceBackendCall(input.method, pathname, "ERR", Date.now() - startedAt, input.requestId, {
        request: input.body,
      });
      if (destroysLocalSession) await clearServerSessionCookie();
      throw error;
    }
    const elapsedMs = Date.now() - startedAt; // the upstream round trip, before session bookkeeping

    // Signed out here at once, so neither this request nor the browser tries to renew it.
    if (!input.anonymous && sessionData.accessToken && (await isSessionEnded(response))) {
      await clearServerSessionCookie();
      sessionData = {};
      sessionChanged = true;
    }

    const responseData = await parseResponse(response);
    let safeData = responseData;
    if (
      destroysLocalSession ||
      (response.ok &&
        (pathname === "/v1/account/delete" || isGlobalSignOutRequest(pathname, input.method)))
    ) {
      await clearServerSessionCookie();
      sessionData = {};
      sessionChanged = true;
    } else if (
      response.ok &&
      isSessionIssuingRequest(pathname, input.method) &&
      isBackendTokenResponse(responseData)
    ) {
      if (
        sessionData.accessToken &&
        pathname !== "/v1/admin/impersonate" &&
        pathname !== "/v1/admin/impersonate/exit"
      ) {
        await fetch(`${getServerApiBaseUrl()}/v1/auth/logout`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${sessionData.accessToken}`,
            "X-Request-Id": input.requestId,
            ...relayed(),
          },
          signal: AbortSignal.timeout(AUTH_CALL_TIMEOUT_MS),
        }).catch(() => undefined);
      }
      const session = await openServerSession();
      if (sessionData.accessToken) await session.clear();
      const organizationSelectionRequired = await signInRequiresOrganizationSelection(
        pathname,
        input.method,
        async () => {
          const organizations = await fetch(
            `${getServerApiBaseUrl()}/v1/me/organizations?limit=2`,
            {
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${responseData.access_token}`,
                "X-Request-Id": input.requestId,
                ...relayed(),
              },
              signal: AbortSignal.timeout(5000),
            },
          );
          return organizations.ok ? parseResponse(organizations) : null;
        },
      );
      await session.update({ ...serverSessionData(responseData), organizationSelectionRequired });
      sessionData = session.data;
      safeData = stripBackendTokens(responseData);
      sessionChanged = true;
    } else if (response.ok && isBackendTokenResponse(responseData)) {
      // Deliberately omits the response: it is the token payload we are refusing.
      traceBackendCall(input.method, pathname, 502, elapsedMs, input.requestId, {
        request: input.body,
      });
      return {
        status: 502,
        data: {
          error: {
            code: "client.unexpected_token_response",
            message: "The server returned credentials from an unexpected endpoint.",
            retryable: false,
          },
        },
        session: toPublicSession(sessionData),
        sessionChanged: false,
      };
    } else if (
      response.ok &&
      input.method === "GET" &&
      pathname === "/v1/me/organizations" &&
      !input.query?.cursor &&
      sessionData.organizationSelectionRequired &&
      !requiresOrganizationSelection(responseData)
    ) {
      const session = await openServerSession();
      await session.update({ organizationSelectionRequired: false });
      sessionData = session.data;
      sessionChanged = true;
    }

    traceBackendCall(input.method, pathname, response.status, elapsedMs, input.requestId, {
      request: input.body,
      response: safeData,
    });
    return {
      status: response.status,
      data: safeData,
      session: toPublicSession(sessionData),
      sessionChanged,
    };
  });

async function resolveServerSession(): Promise<PublicSession> {
  return toPublicSession(await readServerSession());
}

export const getServerSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicSession> => {
    preventSharedCaching();
    return resolveServerSession();
  },
);

export const refreshServerSessionNow = createServerFn({ method: "POST" })
  .validator(
    z.object({
      expectedVersion: z.number().int().nonnegative(),
      force: z.boolean(),
    }),
  )
  .handler(async ({ data }): Promise<SessionRefreshResult> => {
    preventSharedCaching();
    const sessionData = await readServerSession();
    const current = toPublicSession(sessionData);
    if (!current.isAuthenticated) return { session: current, unavailable: false };
    if (current.version !== data.expectedVersion) return { session: current, unavailable: false };

    const expiresAt = current.expiresAt ? Date.parse(current.expiresAt) : Number.NaN;
    if (!data.force && Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000)
      return { session: current, unavailable: false };

    const session = await openServerSession();
    const outcome = await refreshServerSession(session, crypto.randomUUID(), relayed());
    return { session: toPublicSession(session.data), unavailable: outcome === "unavailable" };
  });

export const clearServerSession = createServerFn({ method: "POST" }).handler(async () => {
  await clearServerSessionCookie();
  return { ok: true };
});
