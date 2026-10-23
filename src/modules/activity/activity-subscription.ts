import { activityActions } from "./activity-store";
import { createActivityStream } from "./activity-stream";
import type { ActivityEvent, ConnectionStatus } from "./types/activity.types";

let refCount = 0;
let client: ReturnType<typeof createActivityStream> | null = null;

function onEvents(events: ActivityEvent[]) {
  activityActions.addLiveEvents(events);
}

function onStatusChange(status: "connected" | "reconnecting" | "disconnected") {
  activityActions.setStatus(status as ConnectionStatus);
}

function onLastEventId(id: string) {
  activityActions.setLastEventId(id);
}

/**
 * Takes a reference to the ref-counted SSE subscription, so every view shares one connection.
 * The first reference starts the stream; the returned release function stops it after the last.
 */
export function acquireSubscription(): () => void {
  refCount++;

  if (refCount === 1) {
    client = createActivityStream({ onEvents, onStatusChange, onLastEventId });
    client.start();
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0 && client) {
      client.stop();
      client = null;
    }
  };
}

/** Restarts the shared stream after it has given up reconnecting; a no-op with no subscribers. */
export function restartStream(): void {
  if (client) {
    client.start();
  }
}

/** Stops the stream and resets the ref count between tests. */
export function _resetSubscriptionForTest() {
  if (client) {
    client.stop();
    client = null;
  }
  refCount = 0;
}
