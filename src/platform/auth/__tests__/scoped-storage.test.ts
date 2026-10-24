// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { scopedStorage } from "../scoped-storage";
import type { PublicSession } from "../server-session";
import { sessionStore } from "../session-store";

const SIGNED_OUT: PublicSession = {
  isAuthenticated: false,
  expiresAt: null,
  sessionId: null,
  userId: null,
  tenantId: null,
  version: 0,
  impersonationActor: null,
};

function session(userId: string, tenantId = "tenant-1"): PublicSession {
  return {
    isAuthenticated: true,
    expiresAt: "2030-01-01T00:00:00Z",
    sessionId: `session-${userId}`,
    userId,
    tenantId,
    version: 1,
    impersonationActor: null,
  };
}

const onScopeChange = vi.fn();
const storage = scopedStorage("qeetid.test.recent", { onScopeChange });

beforeEach(() => {
  window.localStorage.clear();
  sessionStore.hydrate(SIGNED_OUT);
  onScopeChange.mockClear();
});

describe("scopedStorage", () => {
  it("saves under the signed-in person and tenant", () => {
    sessionStore.hydrate(session("user-a"));
    storage.write({ entries: ["a"] });

    expect(window.localStorage.getItem("qeetid.test.recent:user-a:tenant-1")).toBe(
      JSON.stringify({ entries: ["a"] }),
    );
    expect(storage.read()).toEqual({ entries: ["a"] });
  });

  it("never reads one person's data for another", () => {
    sessionStore.hydrate(session("user-a"));
    storage.write({ entries: ["a"] });
    // A closed browser: the next person's session starts from nothing.
    sessionStore.set(session("user-b"));

    expect(storage.read()).toBeNull();
  });

  it("keeps a person's data per tenant across a tenant switch", () => {
    sessionStore.hydrate(session("user-a", "tenant-1"));
    storage.write({ entries: ["tenant-1"] });

    sessionStore.set(session("user-a", "tenant-2"));
    expect(storage.read()).toBeNull();

    sessionStore.set(session("user-a", "tenant-1"));
    expect(storage.read()).toEqual({ entries: ["tenant-1"] });
  });

  it("wipes the outgoing person's data on sign-out", () => {
    sessionStore.hydrate(session("user-a"));
    storage.write({ entries: ["a"] });

    sessionStore.clear();

    expect(window.localStorage.getItem("qeetid.test.recent:user-a:tenant-1")).toBeNull();
  });

  it("resets the in-memory copy on every scope change", () => {
    sessionStore.hydrate(session("user-a"));
    sessionStore.set(session("user-a", "tenant-2"));
    sessionStore.clear();

    expect(onScopeChange).toHaveBeenCalledTimes(3);
  });

  it("saves nothing while nobody is signed in", () => {
    storage.write({ entries: ["anonymous"] });

    expect(window.localStorage.length).toBe(0);
    expect(storage.read()).toBeNull();
  });

  it("removes the unscoped key written before data was scoped", () => {
    window.localStorage.setItem("qeetid.test.legacy", JSON.stringify({ entries: ["old"] }));

    scopedStorage("qeetid.test.legacy");

    expect(window.localStorage.getItem("qeetid.test.legacy")).toBeNull();
  });
});
