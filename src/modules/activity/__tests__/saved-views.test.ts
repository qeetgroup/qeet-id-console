// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { sessionStore } from "@/platform/auth/session-store";
import {
  hydrateSavedViews,
  PRESET_VIEWS,
  savedViewsActions,
  savedViewsStore,
} from "../saved-views";

// Saved views are scoped to the signed-in person and tenant.
const STORE_KEY = "qeetid.activity.views:user-a:tenant-1";

beforeEach(() => {
  window.localStorage.clear();
  sessionStore.hydrate({
    isAuthenticated: true,
    expiresAt: "2030-01-01T00:00:00Z",
    sessionId: "session-a",
    userId: "user-a",
    tenantId: "tenant-1",
    version: 1,
    impersonationActor: null,
  });
  savedViewsStore.setState(() => ({ views: [] }));
});

describe("PRESET_VIEWS", () => {
  it("ships built-in investigations with unique ids", () => {
    expect(PRESET_VIEWS.length).toBeGreaterThanOrEqual(5);
    const ids = PRESET_VIEWS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(PRESET_VIEWS.every((v) => v.builtin)).toBe(true);
  });
});

describe("savedViewsActions", () => {
  it("adds a view, strips transient params, and persists", () => {
    const view = savedViewsActions.add("My triage", {
      severity: "error,critical",
      event: "evt-1",
      tab: "raw",
      view: "old",
    });
    expect(view.name).toBe("My triage");
    expect(view.search.severity).toBe("error,critical");
    expect(view.search.event).toBeUndefined();
    expect(view.search.tab).toBeUndefined();
    expect(view.search.view).toBeUndefined();

    expect(savedViewsStore.state.views).toHaveLength(1);
    const raw = window.localStorage.getItem(STORE_KEY);
    expect(raw).toContain("My triage");
  });

  it("removes a view", () => {
    const view = savedViewsActions.add("Temp", { q: "x" });
    savedViewsActions.remove(view.id);
    expect(savedViewsStore.state.views).toHaveLength(0);
  });

  it("renames a view", () => {
    const view = savedViewsActions.add("Old name", { q: "x" });
    savedViewsActions.rename(view.id, "New name");
    expect(savedViewsStore.state.views[0]?.name).toBe("New name");
  });
});

describe("hydrateSavedViews", () => {
  it("restores persisted views from localStorage", () => {
    window.localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ views: [{ id: "v1", name: "Saved", search: { q: "z" }, createdAt: 1 }] }),
    );
    hydrateSavedViews();
    expect(savedViewsStore.state.views).toHaveLength(1);
    expect(savedViewsStore.state.views[0]?.name).toBe("Saved");
  });

  it("ignores a corrupt payload", () => {
    window.localStorage.setItem(STORE_KEY, "{not json");
    hydrateSavedViews();
    expect(savedViewsStore.state.views).toHaveLength(0);
  });
});
