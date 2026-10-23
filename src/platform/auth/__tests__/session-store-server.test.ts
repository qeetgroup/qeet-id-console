// Runs in the node environment: no `window`, as during SSR.
import { describe, expect, it } from "vitest";

import type { PublicSession } from "../server-session";
import { sessionStore } from "../session-store";

const SESSION: PublicSession = {
  isAuthenticated: true,
  expiresAt: "2030-01-01T00:00:00Z",
  sessionId: "session-a",
  userId: "user-a",
  tenantId: "tenant-a",
  version: 1,
  impersonationActor: null,
};

describe("session store on the server", () => {
  it("never holds a session", () => {
    sessionStore.set(SESSION, { broadcast: true });
    sessionStore.hydrate(SESSION);

    expect(sessionStore.getSnapshot().isAuthenticated).toBe(false);
    expect(sessionStore.getUserId()).toBeNull();
    expect(sessionStore.getTenantId()).toBeNull();
  });

  it("never moves the scope generation", () => {
    const generation = sessionStore.getScopeGeneration();

    sessionStore.set(SESSION);
    sessionStore.set({ ...SESSION, userId: "user-b", sessionId: "session-b" });
    sessionStore.clear();

    expect(sessionStore.getScopeGeneration()).toBe(generation);
  });
});
