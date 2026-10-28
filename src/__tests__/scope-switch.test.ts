// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { sessionStore } from "@/platform/auth/session-store";
import type { PublicSession } from "@/platform/auth/server-session";
import { activityActions, activityStore } from "@/modules/activity/activity-store";
import { authzStore, pushDecision, setBuilderDoc } from "@/modules/authorization/store/authz-store";
import { timelineActions, timelineStore } from "@/modules/timeline/timeline-store";

function session(tenantId: string): PublicSession {
  return {
    isAuthenticated: true,
    expiresAt: "2030-01-01T00:00:00Z",
    sessionId: `session-${tenantId}`,
    userId: "user-1",
    tenantId,
    version: 1,
    impersonationActor: null,
  };
}

describe("switching organization in another tab", () => {
  it("drops what the previous organization's screens held in memory", () => {
    sessionStore.set(session("tenant-a"));
    pushDecision({ id: "d-1" } as Parameters<typeof pushDecision>[0]);
    setBuilderDoc({ name: "draft" } as Parameters<typeof setBuilderDoc>[0]);
    activityActions.addLiveEvents([
      {
        id: "e-1",
        type: "user.created",
        category: "directory",
        severity: "success",
        title: "",
        at: "",
      },
    ]);
    timelineActions.setSelectedEventId("e-1");

    sessionStore.set(session("tenant-b"), { broadcast: false });

    expect(authzStore.state).toEqual({ history: [], builderDoc: null, objects: [] });
    expect(activityStore.state.liveEvents).toEqual([]);
    expect(timelineStore.state.selectedEventId).toBeNull();
  });
});
