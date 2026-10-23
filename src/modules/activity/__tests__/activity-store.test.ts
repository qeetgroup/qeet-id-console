import { beforeEach, describe, expect, it } from "vitest";

import {
  _seenIds,
  type ActivityStoreState,
  activityActions,
  activityStore,
} from "../activity-store";
import type { ActivityEvent } from "../types/activity.types";

let eventCounter = 0;

function makeEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  eventCounter++;
  return {
    id: `evt-${eventCounter}`,
    type: "user.login",
    category: "authentication",
    severity: "info",
    title: `Login event ${eventCounter}`,
    at: new Date(Date.now() - eventCounter * 1000).toISOString(),
    ...overrides,
  };
}

function getState(): ActivityStoreState {
  return activityStore.state;
}

beforeEach(() => {
  activityActions.clearAll();
  _seenIds.clear();
  activityActions.setStatus("disconnected");
});

describe("addLiveEvents", () => {
  it("keeps the stream's frame id as the resume point, never an event's id", () => {
    activityActions.setLastEventId("cursor-9");
    activityActions.addLiveEvents([makeEvent({ id: "evt-uuid-1" })]);
    expect(activityStore.state.lastEventId).toBe("cursor-9");
  });

  it("prepends new events newest-first", () => {
    const a = makeEvent({ title: "A" });
    const b = makeEvent({ title: "B" });

    activityActions.addLiveEvents([b, a]); // pass newest first
    expect(getState().liveEvents[0]?.title).toBe("B");
    expect(getState().liveEvents[1]?.title).toBe("A");
  });

  it("deduplicates events by id", () => {
    const evt = makeEvent();
    activityActions.addLiveEvents([evt]);
    activityActions.addLiveEvents([evt]); // duplicate
    expect(getState().liveEvents).toHaveLength(1);
  });

  it("increments unreadCount for each new event", () => {
    activityActions.addLiveEvents([makeEvent(), makeEvent()]);
    expect(getState().unreadCount).toBe(2);
  });

  it("caps liveEvents at MAX_LIVE (200)", () => {
    const events = Array.from({ length: 220 }, () => makeEvent());
    activityActions.addLiveEvents(events);
    expect(getState().liveEvents.length).toBeLessThanOrEqual(200);
  });

  it("queues into pendingBuffer when paused", () => {
    activityActions.setPaused(true);
    const evt = makeEvent();
    activityActions.addLiveEvents([evt]);
    expect(getState().pendingBuffer).toHaveLength(1);
    expect(getState().liveEvents).toHaveLength(0);
    expect(getState().unreadCount).toBe(0);
  });
});

describe("setPaused", () => {
  it("flushes pendingBuffer into liveEvents on resume", () => {
    activityActions.setPaused(true);
    const evts = [makeEvent(), makeEvent(), makeEvent()];
    activityActions.addLiveEvents(evts);
    expect(getState().pendingBuffer).toHaveLength(3);

    activityActions.setPaused(false);
    expect(getState().liveEvents).toHaveLength(3);
    expect(getState().pendingBuffer).toHaveLength(0);
    expect(getState().unreadCount).toBe(3);
  });

  it("deduplicates pending events against already-seen ids on flush", () => {
    const shared = makeEvent();
    activityActions.addLiveEvents([shared]); // add to live first
    activityActions.setPaused(true);
    activityActions.addLiveEvents([shared]); // already seen, so never queued
    activityActions.setPaused(false);
    expect(getState().liveEvents).toHaveLength(1);
  });

  it("is idempotent when called with the same state", () => {
    activityActions.setPaused(true);
    const before = getState();
    activityActions.setPaused(true); // no-op
    expect(getState()).toBe(before);
  });
});

describe("markAllRead", () => {
  it("resets unreadCount to 0", () => {
    activityActions.addLiveEvents([makeEvent(), makeEvent()]);
    expect(getState().unreadCount).toBe(2);
    activityActions.markAllRead();
    expect(getState().unreadCount).toBe(0);
  });
});

describe("clearAll", () => {
  it("empties liveEvents, pendingBuffer, and resets counters", () => {
    activityActions.addLiveEvents([makeEvent(), makeEvent()]);
    activityActions.setPaused(true);
    activityActions.addLiveEvents([makeEvent()]);
    activityActions.clearAll();

    const s = getState();
    expect(s.liveEvents).toHaveLength(0);
    expect(s.pendingBuffer).toHaveLength(0);
    expect(s.unreadCount).toBe(0);
    expect(s.lastEventId).toBeNull();
  });

  it("clears the seenIds set so previously-seen events can be re-added", () => {
    const evt = makeEvent();
    activityActions.addLiveEvents([evt]);
    activityActions.clearAll();
    activityActions.addLiveEvents([evt]); // should succeed after clear
    expect(getState().liveEvents).toHaveLength(1);
  });
});

describe("setStatus", () => {
  it("updates the connection status", () => {
    activityActions.setStatus("connected");
    expect(getState().status).toBe("connected");
  });

  it("does not override 'paused' status when paused", () => {
    activityActions.setPaused(true);
    expect(getState().status).toBe("paused");
    activityActions.setStatus("connected"); // should be ignored
    expect(getState().status).toBe("paused");
  });
});
