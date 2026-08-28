import {
  clearSession,
  getCookies,
  getRequestProtocol,
  unsealSession,
  useSession as openEncryptedSession,
} from "@tanstack/react-start/server";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const DEVELOPMENT_SESSION_SECRET = "qeet-id-console-development-session-secret-only";

export type ServerSessionData = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  sessionId?: string;
  userId?: string;
  tenantId?: string;
  version?: number;
};

export type PublicSession = {
  isAuthenticated: boolean;
  expiresAt: string | null;
  sessionId: string | null;
  userId: string | null;
  tenantId: string | null;
  version: number;
  impersonationActor: {
    targetSubject: string;
    actorSubject: string;
    actorEmail?: string;
    actorDisplayName?: string;
  } | null;
};

type AccessClaims = {
  sub?: string;
  act?: {
    sub?: string;
    email?: string;
    display_name?: string;
  };
};

function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV !== "production") return DEVELOPMENT_SESSION_SECRET;
  throw new Error("SESSION_SECRET must contain at least 32 characters in production.");
}

function sessionConfig() {
  const secure =
    process.env.NODE_ENV === "production" ||
    getRequestProtocol({ xForwardedProto: true }) === "https";

  return {
    name: secure ? "__Host-qeet_console" : "qeet_console_dev",
    password: sessionSecret(),
    maxAge: SESSION_MAX_AGE_SECONDS,
    sessionHeader: false as const,
    cookie: {
      httpOnly: true,
      secure,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export async function openServerSession() {
  return openEncryptedSession<ServerSessionData>(sessionConfig());
}

function sealedSessionCookie(): string | null {
  const { name } = sessionConfig();
  const cookies = getCookies();
  const main = cookies[name];
  if (!main) return null;
  if (!main.startsWith("__chunked__")) return main;

  const count = Number.parseInt(main.slice("__chunked__".length), 10);
  if (!Number.isInteger(count) || count < 1 || count > 100) return null;
  const chunks: string[] = [];
  for (let index = 1; index <= count; index++) {
    const chunk = cookies[`${name}.${index}`];
    if (!chunk) return null;
    chunks.push(chunk);
  }
  return chunks.join("");
}

export async function readServerSession(): Promise<ServerSessionData> {
  const sealed = sealedSessionCookie();
  if (!sealed) return {};
  try {
    const session = await unsealSession(sessionConfig(), sealed);
    return (session.data ?? {}) as ServerSessionData;
  } catch {
    await clearSession(sessionConfig());
    return {};
  }
}

export function clearServerSessionCookie() {
  return clearSession(sessionConfig());
}

function accessClaims(accessToken?: string): AccessClaims | null {
  if (!accessToken) return null;
  const parts = accessToken.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as AccessClaims;
  } catch {
    return null;
  }
}

export function toPublicSession(data: ServerSessionData): PublicSession {
  const claims = accessClaims(data.accessToken);
  const impersonationActor =
    claims?.sub && claims.act?.sub
      ? {
          targetSubject: claims.sub,
          actorSubject: claims.act.sub,
          actorEmail: claims.act.email,
          actorDisplayName: claims.act.display_name,
        }
      : null;

  return {
    isAuthenticated: !!data.accessToken && !!data.refreshToken && !!data.userId,
    expiresAt: data.expiresAt ?? null,
    sessionId: data.sessionId ?? null,
    userId: data.userId ?? null,
    tenantId: data.tenantId ?? null,
    version: data.version ?? 0,
    impersonationActor,
  };
}
