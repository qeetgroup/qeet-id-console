// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicSession } from "../server-session";
import { onSessionClear, purgeLegacyTokenStorage, sessionStore } from "../session-store";

const EMPTY_SESSION: PublicSession = {
  isAuthenticated: false,
  expiresAt: null,
  sessionId: null,
  userId: null,
  tenantId: null,
  version: 0,
  impersonationActor: null,
};

const AUTHENTICATED_SESSION: PublicSession = {
  isAuthenticated: true,
  expiresAt: "2030-01-01T00:00:00Z",
  sessionId: "session-1",
  userId: "user-1",
  tenantId: "tenant-1",
  version: 1,
  impersonationActor: null,
};

beforeEach(() => {
  window.localStorage.clear();
  sessionStore.hydrate(EMPTY_SESSION);
});

describe("public session store", () => {
  it("purges every legacy browser credential key", () => {
    window.localStorage.setItem("qeetid.access_token", "access-secret");
    window.localStorage.setItem("qeetid.refresh_token", "refresh-secret");
    window.localStorage.setItem("qeetid.tenant_id", "tenant-1");
    window.localStorage.setItem("qeetid.user_id", "user-1");

    purgeLegacyTokenStorage();

    expect(window.localStorage.getItem("qeetid.access_token")).toBeNull();
    expect(window.localStorage.getItem("qeetid.refresh_token")).toBeNull();
    expect(window.localStorage.getItem("qeetid.tenant_id")).toBeNull();
    expect(window.localStorage.getItem("qeetid.user_id")).toBeNull();
  });

  it("keeps public session metadata in memory only", () => {
    sessionStore.hydrate(AUTHENTICATED_SESSION);

    expect(sessionStore.getSnapshot()).toEqual(AUTHENTICATED_SESSION);
    expect(window.localStorage.length).toBe(0);
    expect(JSON.stringify(sessionStore.getSnapshot())).not.toContain("token");
  });

  it("runs module cleanup before changing tenant scope", () => {
    sessionStore.hydrate(AUTHENTICATED_SESSION);
    const clear = vi.fn();
    const unsubscribe = onSessionClear(clear);

    sessionStore.hydrate({ ...AUTHENTICATED_SESSION, tenantId: "tenant-2" });

    expect(clear).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it.each([
    ["user", { userId: "user-2" }],
    ["session", { sessionId: "session-2" }],
    [
      "impersonation enter",
      {
        impersonationActor: {
          targetSubject: "user-1",
          actorSubject: "admin-1",
          actorEmail: "admin@example.com",
        },
      },
    ],
  ])("advances the generation before cleanup on %s change", (_label, patch) => {
    sessionStore.hydrate(AUTHENTICATED_SESSION);
    const generation = sessionStore.getScopeGeneration();
    const observed: number[] = [];
    const unsubscribe = onSessionClear(() => observed.push(sessionStore.getScopeGeneration()));

    sessionStore.set({ ...AUTHENTICATED_SESSION, ...patch });

    expect(sessionStore.getScopeGeneration()).toBe(generation + 1);
    expect(observed).toEqual([generation + 1]);
    unsubscribe();
  });

  it("does not clear scope-owned state for an expiry-only refresh", () => {
    sessionStore.hydrate(AUTHENTICATED_SESSION);
    const generation = sessionStore.getScopeGeneration();
    const clear = vi.fn();
    const unsubscribe = onSessionClear(clear);

    sessionStore.set({ ...AUTHENTICATED_SESSION, expiresAt: "2030-02-01T00:00:00Z", version: 2 });

    expect(sessionStore.getScopeGeneration()).toBe(generation);
    expect(clear).not.toHaveBeenCalled();
    unsubscribe();
  });
});
