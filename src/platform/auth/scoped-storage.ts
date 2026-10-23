// Browser storage for one person's data in one tenant, keyed `<base>:<userId>:<tenantId>` so a
// shared browser never loads it for someone else. Signing out, in any tab, removes the outgoing
// person's values; an unscoped `<base>` key can't be attributed to anyone, so it is deleted.
import { useSyncExternalStore } from "react";

import type { PublicSession } from "@/platform/auth/server-session";
import { onSessionClear, sessionStore } from "@/platform/auth/session-store";

export interface ScopedStorage {
  read(): unknown; // the current person and tenant's value, or null
  write(value: unknown): void; // no-op when nobody is signed in
  remove(): void; // removes the current person and tenant's value
}

interface ScopedStorageOptions {
  onScopeChange?: () => void; // resets in-memory copies before the new session shows
}

const registered = new Map<string, ScopedStorageOptions>();

function scopeOf(session: PublicSession): string | null {
  if (!session.isAuthenticated || !session.userId) return null;
  return `${session.userId}:${session.tenantId ?? "-"}`;
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function keyFor(base: string): string | null {
  const scope = scopeOf(sessionStore.getSnapshot());
  return scope ? `${base}:${scope}` : null;
}

function removeKey(key: string) {
  try {
    browserStorage()?.removeItem(key);
  } catch {
    // Storage may be disabled; nothing was saved then.
  }
}

/** Storage for values under `base`, scoped to whoever is signed in when it is read or written. */
export function scopedStorage(base: string, options: ScopedStorageOptions = {}): ScopedStorage {
  registered.set(base, options);
  removeKey(base);
  return {
    read() {
      const key = keyFor(base);
      if (!key) return null;
      try {
        const raw = browserStorage()?.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    write(value) {
      const key = keyFor(base);
      if (!key) return;
      try {
        browserStorage()?.setItem(key, JSON.stringify(value));
      } catch {
        // Quota or private mode: persistence is best-effort.
      }
    },
    remove() {
      const key = keyFor(base);
      if (key) removeKey(key);
    },
  };
}

// Runs before `next` is visible, so keyFor() still names the outgoing scope.
onSessionClear((next) => {
  for (const [base, options] of registered) {
    if (!next.isAuthenticated) {
      const key = keyFor(base);
      if (key) removeKey(key);
    }
    options.onScopeChange?.();
  }
});

/**
 * Returns the current storage scope, or null when signed out. Re-read scoped storage when it
 * changes: it is known only after the session hydrates.
 */
export function useStorageScope(): string | null {
  return useSyncExternalStore(
    sessionStore.subscribe,
    () => scopeOf(sessionStore.getSnapshot()),
    () => null,
  );
}
