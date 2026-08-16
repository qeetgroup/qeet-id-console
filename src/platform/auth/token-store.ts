// Client-side session token store. The access/refresh tokens plus the active
// tenant/user ids are persisted in localStorage and read reactively elsewhere
// via `useSyncExternalStore` (see platform/auth/session.ts).
//
// NOTE (security, tracked): access + refresh tokens live in localStorage and are
// therefore readable by any script in the origin. Migrating to httpOnly cookies
// is deferred — it requires backend + SSR-guard changes. See SECURITY.md.
const TOKEN_KEY = "qeetid.access_token";
const REFRESH_KEY = "qeetid.refresh_token";
const TENANT_KEY = "qeetid.tenant_id";
const USER_KEY = "qeetid.user_id";
export const TOKEN_STORE_EVENT = "qeetid:token-store-change";

function notifyTokenStore() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TOKEN_STORE_EVENT));
}

// Session-clear listeners. Features register cleanup that must run on logout
// (e.g. wiping the Qeet AI conversation history from localStorage) WITHOUT the
// platform layer importing those features — dependency is inverted here.
const clearListeners = new Set<() => void>();

/** Register a callback to run whenever the session is cleared (logout). */
export function onTokenStoreClear(listener: () => void): () => void {
  clearListeners.add(listener);
  return () => {
    clearListeners.delete(listener);
  };
}

export const tokenStore = {
  get: () => (typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null),
  set: (t: string) => window.localStorage.setItem(TOKEN_KEY, t),
  clear: () => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.localStorage.removeItem(TENANT_KEY);
    window.localStorage.removeItem(USER_KEY);
    // Run registered logout cleanups (e.g. clear Qeet AI conversations) before
    // notifying subscribers, so nothing rehydrates stale session-scoped data.
    for (const listener of clearListeners) {
      try {
        listener();
      } catch {
        /* a misbehaving listener must not block sign-out */
      }
    }
    notifyTokenStore();
  },
  getRefresh: () =>
    typeof window !== "undefined" ? window.localStorage.getItem(REFRESH_KEY) : null,
  setRefresh: (t: string) => window.localStorage.setItem(REFRESH_KEY, t),
  getTenantId: () =>
    typeof window !== "undefined" ? window.localStorage.getItem(TENANT_KEY) : null,
  setTenantId: (id: string) => {
    window.localStorage.setItem(TENANT_KEY, id);
    notifyTokenStore();
  },
  getUserId: () => (typeof window !== "undefined" ? window.localStorage.getItem(USER_KEY) : null),
  setUserId: (id: string) => window.localStorage.setItem(USER_KEY, id),
  subscribe: (listener: () => void) => {
    if (typeof window === "undefined") return () => undefined;
    const onStorage = (event: StorageEvent) => {
      if (event.key === TENANT_KEY || event.key === null) listener();
    };
    window.addEventListener(TOKEN_STORE_EVENT, listener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(TOKEN_STORE_EVENT, listener);
      window.removeEventListener("storage", onStorage);
    };
  },
};
