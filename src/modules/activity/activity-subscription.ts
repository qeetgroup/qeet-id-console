import { onSessionClear } from "@/platform/auth/session-store";

import { activityActions, activityStore } from "./activity-store";
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
function openClient() {
  // Carries on from the last frame an earlier subscription saw, so the feed has no gap.
  client = createActivityStream(
    { onEvents, onStatusChange, onLastEventId },
    activityStore.state.lastEventId,
  );
  client.start();
}

// Another organisation or person must not see this one's events, and an open stream would keep
// delivering them: drop them and reconnect as the new session, once it is visible.
onSessionClear((next) => {
  client?.stop();
  client = null;
  if (refCount > 0 && next.isAuthenticated)
    queueMicrotask(() => refCount > 0 && !client && openClient());
});

export function acquireSubscription(): () => void {
  refCount++;

  if (refCount === 1) openClient();

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
