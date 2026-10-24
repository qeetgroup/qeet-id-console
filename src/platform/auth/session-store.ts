import type { PublicSession } from "@/platform/auth/server-session";

const SESSION_CHANNEL = "qeetid:session";
const SESSION_EVENT_KEY = "qeetid.session-event";
const LEGACY_TOKEN_KEYS = [
  "qeetid.access_token",
  "qeetid.refresh_token",
  "qeetid.tenant_id",
  "qeetid.user_id",
] as const;

export function purgeLegacyTokenStorage() {
  if (typeof window === "undefined") return;
  try {
    for (const key of LEGACY_TOKEN_KEYS) window.localStorage.removeItem(key);
  } catch {
    // Storage may be disabled; nothing reads these keys, so a failed purge is harmless.
  }
}

const EMPTY_SESSION: PublicSession = {
  isAuthenticated: false,
  expiresAt: null,
  sessionId: null,
  userId: null,
  tenantId: null,
  version: 0,
  organizationSelectionRequired: false,
  impersonationActor: null,
};

let currentSession = EMPTY_SESSION;
let scopeGeneration = 0;
const subscribers = new Set<() => void>();
const clearListeners = new Set<(next: PublicSession) => void>();

/**
 * Runs `listener` whenever the security scope changes (sign-in, sign-out, or a user, tenant or
 * impersonation switch), before the new session is visible. It receives the next session, so a
 * module can tell a sign-out (`!next.isAuthenticated`) from a switch.
 */
export function onSessionClear(listener: (next: PublicSession) => void): () => void {
  clearListeners.add(listener);
  return () => {
    clearListeners.delete(listener);
  };
}

function notifySubscribers() {
  for (const subscriber of subscribers) subscriber();
}

function runClearListeners(next: PublicSession) {
  for (const listener of clearListeners) {
    try {
      listener(next);
    } catch {
      // A module cleanup must not prevent the session transition.
    }
  }
}

function securityScopeChanged(left: PublicSession, right: PublicSession): boolean {
  return (
    left.isAuthenticated !== right.isAuthenticated ||
    left.sessionId !== right.sessionId ||
    left.userId !== right.userId ||
    left.tenantId !== right.tenantId ||
    JSON.stringify(left.impersonationActor) !== JSON.stringify(right.impersonationActor)
  );
}

function transitionScope(next: PublicSession) {
  scopeGeneration += 1;
  runClearListeners(next);
  currentSession = next;
}

type SessionEvent = {
  type: "changed" | "cleared";
  source: string;
  nonce: string;
};

const source =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function publish(type: SessionEvent["type"]) {
  if (typeof window === "undefined") return;
  const event: SessionEvent = {
    type,
    source,
    nonce: `${Date.now()}:${Math.random()}`,
  };
  try {
    const channel = new BroadcastChannel(SESSION_CHANNEL);
    channel.postMessage(event);
    channel.close();
  } catch {
    // The storage event below is the compatibility path.
  }
  try {
    window.localStorage.setItem(SESSION_EVENT_KEY, JSON.stringify(event));
    window.localStorage.removeItem(SESSION_EVENT_KEY);
  } catch {
    // Cross-tab propagation is best-effort when browser storage is disabled.
  }
}

function sameSession(left: PublicSession, right: PublicSession): boolean {
  return (
    left.isAuthenticated === right.isAuthenticated &&
    left.expiresAt === right.expiresAt &&
    left.sessionId === right.sessionId &&
    left.userId === right.userId &&
    left.tenantId === right.tenantId &&
    left.version === right.version &&
    !!left.organizationSelectionRequired === !!right.organizationSelectionRequired &&
    JSON.stringify(left.impersonationActor) === JSON.stringify(right.impersonationActor)
  );
}

function applyRemoteEvent(event: SessionEvent) {
  if (event.source === source || typeof window === "undefined") return;
  if (event.type === "cleared") {
    const wasAuthenticated = currentSession.isAuthenticated;
    if (wasAuthenticated) transitionScope(EMPTY_SESSION);
    notifySubscribers();
    if (window.location.pathname !== "/sign-in") window.location.assign("/sign-in");
    return;
  }
  window.location.reload();
}

let sessionChannel: BroadcastChannel | null = null;

if (typeof window !== "undefined") {
  purgeLegacyTokenStorage();
  try {
    sessionChannel = new BroadcastChannel(SESSION_CHANNEL);
    sessionChannel.addEventListener("message", (event: MessageEvent<SessionEvent>) => {
      applyRemoteEvent(event.data);
    });
  } catch {
    // Storage events remain available when BroadcastChannel is unsupported.
  }
  window.addEventListener("storage", (event) => {
    if (event.key !== SESSION_EVENT_KEY || !event.newValue) return;
    try {
      applyRemoteEvent(JSON.parse(event.newValue) as SessionEvent);
    } catch {
      // Ignore malformed events from unrelated scripts.
    }
  });
}

// Inert on the server, where this module is shared by every concurrent request: a session held
// here would leak into another person's render and move their scope generation. The server reads
// the session per request from the cookie; the browser hydrates this store from that.
const isServer = typeof window === "undefined";

export const sessionStore = {
  getSnapshot: () => currentSession,
  getScopeGeneration: () => scopeGeneration,
  set: (next: PublicSession, options: { broadcast?: boolean } = {}) => {
    if (isServer || sameSession(currentSession, next)) return;
    const scopeChanged = securityScopeChanged(currentSession, next);
    const authChanged = currentSession.isAuthenticated !== next.isAuthenticated;
    if (scopeChanged) transitionScope(next);
    else currentSession = next;
    notifySubscribers();
    if (options.broadcast && (scopeChanged || authChanged)) {
      publish(next.isAuthenticated ? "changed" : "cleared");
    }
  },
  hydrate: (session: PublicSession) => {
    sessionStore.set(session);
  },
  clear: () => {
    if (isServer) return;
    const wasAuthenticated = currentSession.isAuthenticated;
    if (wasAuthenticated) transitionScope(EMPTY_SESSION);
    else currentSession = EMPTY_SESSION;
    notifySubscribers();
    publish("cleared");
  },
  getTenantId: () => currentSession.tenantId,
  getUserId: () => currentSession.userId,
  getSessionId: () => currentSession.sessionId,
  getImpersonationActor: () => currentSession.impersonationActor,
  subscribe: (listener: () => void) => {
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  },
};
