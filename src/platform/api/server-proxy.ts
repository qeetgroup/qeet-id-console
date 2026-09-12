import { createServerFn } from "@tanstack/react-start";
import { getRequest, getResponse } from "@tanstack/react-start/server";
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
  isLocalSessionDestroyRequest,
} from "@/platform/api/server-request-policy";
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
        // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the intent
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

async function refreshSession(
  session: Awaited<ReturnType<typeof openServerSession>>,
  requestId: string,
): Promise<boolean> {
  if (!session.data.refreshToken) return false;
  const flightKey = session.data.sessionId ?? session.data.refreshToken;
  let flight = refreshFlights.get(flightKey);
  if (!flight) {
    const refreshToken = session.data.refreshToken;
    flight = (async () => {
      const response = await fetch(`${getServerApiBaseUrl()}/v1/auth/refresh`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data = await parseResponse(response);
      return response.ok && isBackendTokenResponse(data) ? serverSessionData(data) : null;
    })().finally(() => {
      refreshFlights.delete(flightKey);
    });
    refreshFlights.set(flightKey, flight);
  }
  const refreshed = await flight;
  if (!refreshed) {
    await session.clear();
    return false;
  }
  await session.update({
    ...refreshed,
    organizationSelectionRequired: session.data.organizationSelectionRequired === true,
    version: (session.data.version ?? 0) + 1,
  });
  return true;
}

const refreshFlights = new Map<string, Promise<ServerSessionData | null>>();

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
  };
  if (input.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const userAgent = incoming.headers.get("user-agent");
  if (userAgent) headers["User-Agent"] = userAgent;

  return fetch(url, {
    method: input.method,
    headers,
    body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
  });
}

// Dev-only trace of the real outbound call. The browser's Network tab stops at
// the server function, so without this the upstream endpoint, status and bodies
// are invisible in both the browser and the dev-server terminal.
//
// Bodies go through `bodies`, never the message string: `logger` deep-redacts
// its context argument, so denylisted keys (password, *token*, otp, recovery,
// cookie, credential, …) are dropped and emails/IPs masked before anything
// prints. The query string is still excluded entirely — it can carry one-time
// tokens under key names redact() doesn't know. `logger` is DEV-gated and
// no-ops in production, so this cannot become a prod log sink by accident.
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
    const startedAt = Date.now();
    try {
      response = await forwardRequest(
        input,
        target,
        input.anonymous ? undefined : sessionData.accessToken,
      );
    } catch (error) {
      traceBackendCall(input.method, pathname, "ERR", Date.now() - startedAt, input.requestId, {
        request: input.body,
      });
      if (destroysLocalSession) await clearServerSessionCookie();
      throw error;
    }
    // Measured here so the timing stays the upstream round trip, not the
    // session bookkeeping that follows.
    const elapsedMs = Date.now() - startedAt;

    const responseData = await parseResponse(response);
    let safeData = responseData;
    let sessionChanged = false;
    if (destroysLocalSession || (response.ok && pathname === "/v1/account/delete")) {
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
          },
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
  .handler(async ({ data }): Promise<PublicSession> => {
    preventSharedCaching();
    const sessionData = await readServerSession();
    const current = toPublicSession(sessionData);
    if (!current.isAuthenticated) return current;
    if (current.version !== data.expectedVersion) return current;

    const expiresAt = current.expiresAt ? Date.parse(current.expiresAt) : Number.NaN;
    if (!data.force && Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000)
      return current;

    const session = await openServerSession();
    await refreshServerSession(session, crypto.randomUUID());
    return toPublicSession(session.data);
  });

export const clearServerSession = createServerFn({ method: "POST" }).handler(async () => {
  await clearServerSessionCookie();
  return { ok: true };
});
