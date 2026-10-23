// Live activity events from the SSE stream only; history pages live in TanStack Query.

import { Store } from "@tanstack/react-store";

import type { ActivityEvent, ConnectionStatus } from "./types/activity.types";
import { onSessionClear } from "@/platform/auth/session-store";

const MAX_LIVE = 200;
const PREFS_KEY = "qeetid.activity.prefs";

export interface ActivityStoreState {
  liveEvents: ActivityEvent[]; // Newest first, capped at MAX_LIVE
  pendingBuffer: ActivityEvent[]; // Events queued while paused; flushed on resume
  unreadCount: number; // Live events added since the last markAllRead()
  paused: boolean; // Incoming events go to pendingBuffer instead of liveEvents
  status: ConnectionStatus; // Stream state, held at "paused" while paused
  /**
   * The newest SSE frame id (`id:`) the stream delivered, never an event's own id: the server's
   * resume cursor, so a new subscription carries on from it.
   */
  lastEventId: string | null;
}

/** Ids already added to liveEvents, so replayed or repeated events aren't shown twice. */
const seenIds = new Set<string>();

export const activityStore = new Store<ActivityStoreState>({
  liveEvents: [],
  pendingBuffer: [],
  unreadCount: 0,
  paused: false,
  status: "disconnected",
  lastEventId: null,
});

/** Restores the persisted paused preference. */
export function initActivityPrefs() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { paused?: boolean };
    if (parsed.paused) {
      activityStore.setState((s) => ({ ...s, paused: true, status: "paused" as ConnectionStatus }));
    }
  } catch {
    // corrupt payload — start with defaults
  }
}

function savePrefs(paused: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ paused }));
  } catch {
    // best-effort
  }
}

/** Returns the unseen events in order and marks them seen. */
function dedupeNew(incoming: ActivityEvent[]): ActivityEvent[] {
  const fresh: ActivityEvent[] = [];
  for (const e of incoming) {
    if (!seenIds.has(e.id)) {
      seenIds.add(e.id);
      fresh.push(e);
    }
  }
  return fresh;
}

export const activityActions = {
  /** Prepends unseen events to liveEvents, or queues them in pendingBuffer while paused. */
  addLiveEvents(incoming: ActivityEvent[]) {
    activityStore.setState((s) => {
      if (s.paused) {
        // Not marked seen yet: dedupeNew on resume would otherwise drop them.
        const trulyNew = incoming.filter((e) => !seenIds.has(e.id));
        if (trulyNew.length === 0) return s;
        return { ...s, pendingBuffer: [...trulyNew, ...s.pendingBuffer] };
      }
      const fresh = dedupeNew(incoming);
      if (fresh.length === 0) return s;
      const liveEvents = [...fresh, ...s.liveEvents].slice(0, MAX_LIVE);
      return { ...s, liveEvents, unreadCount: s.unreadCount + fresh.length };
    });
  },

  setPaused(paused: boolean) {
    activityStore.setState((s) => {
      if (paused === s.paused) return s;
      if (paused) {
        savePrefs(true);
        return { ...s, paused: true, status: "paused" as ConnectionStatus };
      }
      const fresh = dedupeNew(s.pendingBuffer);
      const liveEvents = [...fresh, ...s.liveEvents].slice(0, MAX_LIVE);
      savePrefs(false);
      return {
        ...s,
        paused: false,
        status: "connected" as ConnectionStatus,
        pendingBuffer: [],
        liveEvents,
        unreadCount: s.unreadCount + fresh.length,
      };
    });
  },

  setStatus(status: ConnectionStatus) {
    activityStore.setState((s) => {
      // While paused, the status stays "paused" whatever the stream reports.
      if (s.paused && status !== "paused") return s;
      return { ...s, status };
    });
  },

  setLastEventId(id: string) {
    activityStore.setState((s) => ({ ...s, lastEventId: id }));
  },

  markAllRead() {
    activityStore.setState((s) => ({ ...s, unreadCount: 0 }));
  },

  clearAll() {
    seenIds.clear();
    activityStore.setState((_s) => ({
      liveEvents: [],
      pendingBuffer: [],
      unreadCount: 0,
      paused: false,
      status: "disconnected" as ConnectionStatus,
      lastEventId: null,
    }));
  },
};

// Events belong to the outgoing organisation; another must never see them.
onSessionClear(() => activityActions.clearAll());

/** For unit tests only. */
export { seenIds as _seenIds };
