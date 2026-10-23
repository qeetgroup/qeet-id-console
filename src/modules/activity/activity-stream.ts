import { clearBrowserSession, refreshSessionForRequest } from "@/platform/api/client";

import type { ActivityEvent } from "./types/activity.types";

/**
 * Parses one SSE frame (the text between blank lines) into an ActivityEvent. Returns null for
 * keep-alives, other event types, and malformed or id-less JSON.
 */
export function parseActivityFrame(frame: string): ActivityEvent | null {
  let eventType = "activity";
  const dataLines: string[] = [];

  for (const line of frame.split("\n")) {
    if (line.startsWith(":")) continue; // keep-alive / comment
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (eventType !== "activity") return null;
  if (dataLines.length === 0) return null;

  try {
    const data = JSON.parse(dataLines.join("\n")) as Partial<ActivityEvent>;
    if (typeof data.id !== "string" || !data.id) return null;
    if (typeof data.type !== "string") return null;
    // Only id and type are checked; the backend owns the full schema.
    return data as ActivityEvent;
  } catch {
    return null;
  }
}

function extractFrameId(frame: string): string | null {
  for (const line of frame.split("\n")) {
    if (line.startsWith("id:")) return line.slice(3).trim();
  }
  return null;
}

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;
const BURST_FLUSH_MS = 50;
/** Consecutive reconnects tried before the stream gives up as "disconnected"; start() retries. */
const MAX_RECONNECT_ATTEMPTS = 5;

export type ActivityStreamCallbacks = {
  onEvents: (events: ActivityEvent[]) => void;
  onStatusChange: (status: "connected" | "reconnecting" | "disconnected") => void;
  onLastEventId: (id: string) => void;
};

/**
 * Returns a `start()`/`stop()` client for the activity SSE stream. It delivers events in short
 * bursts, reconnects with exponential backoff and resumes from Last-Event-ID. `stop()` aborts
 * any in-flight fetch and flushes buffered events.
 */
export function createActivityStream(callbacks: ActivityStreamCallbacks) {
  let stopped = false;
  let abortController: AbortController | null = null;
  let backoffMs = INITIAL_BACKOFF_MS;
  let backoffTimer: ReturnType<typeof setTimeout> | null = null;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let burstBuffer: ActivityEvent[] = [];
  let lastEventId: string | null = null;
  let reconnectAttempts = 0;

  function flushBurst() {
    flushTimer = null;
    if (burstBuffer.length === 0) return;
    const toFlush = burstBuffer;
    burstBuffer = [];
    callbacks.onEvents(toFlush);
  }

  function scheduleFlush(event: ActivityEvent) {
    burstBuffer.push(event);
    if (!flushTimer) {
      flushTimer = setTimeout(flushBurst, BURST_FLUSH_MS);
    }
  }

  function scheduleReconnect() {
    if (stopped) return;
    reconnectAttempts++;
    if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      stopped = true;
      callbacks.onStatusChange("disconnected");
      return;
    }
    callbacks.onStatusChange("reconnecting");
    const delay = backoffMs;
    backoffMs = Math.min(backoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
    backoffTimer = setTimeout(() => {
      void connect();
    }, delay);
  }

  async function connect(hasRetriedAuth = false) {
    if (stopped) return;

    abortController = new AbortController();
    const { signal } = abortController;

    callbacks.onStatusChange("reconnecting");

    const url = new URL("/api/activity-stream", window.location.origin);
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    };
    if (lastEventId) headers["Last-Event-ID"] = lastEventId;

    let res: Response;
    try {
      res = await fetch(url, { method: "GET", headers, signal });
    } catch {
      if (stopped || signal.aborted) return;
      scheduleReconnect();
      return;
    }

    if (!res.ok || !res.body) {
      if (stopped) return;
      if (res.status === 401) {
        let refreshed = false;
        try {
          refreshed = !hasRetriedAuth && (await refreshSessionForRequest(signal, true));
        } catch {
          // Qeet ID couldn't renew the session right now but didn't reject it:
          // stay signed in and back off, as for any other unavailable stream.
          if (!stopped && !signal.aborted) scheduleReconnect();
          return;
        }
        if (refreshed) {
          await connect(true);
          return;
        }
        await clearBrowserSession();
        return;
      }
      // Any other error status (e.g. 404/503 from an undeployed backend) retries silently.
      scheduleReconnect();
      return;
    }

    backoffMs = INITIAL_BACKOFF_MS;
    reconnectAttempts = 0;
    callbacks.onStatusChange("connected");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let sep = buffer.indexOf("\n\n");

        while (sep !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);

          // Remembered so a reconnect resumes from here via Last-Event-ID.
          const frameId = extractFrameId(frame);
          if (frameId) {
            lastEventId = frameId;
            callbacks.onLastEventId(frameId);
          }

          const event = parseActivityFrame(frame);
          if (event) scheduleFlush(event);

          sep = buffer.indexOf("\n\n");
        }
      }
    } catch {
      if (stopped || signal.aborted) return;
    } finally {
      try {
        await reader.cancel();
      } catch {
        // reader already released
      }
    }

    if (!stopped) scheduleReconnect();
  }

  return {
    start() {
      // Restarting replaces a live connection or pending retry instead of opening a second one.
      if (backoffTimer !== null) {
        clearTimeout(backoffTimer);
        backoffTimer = null;
      }
      abortController?.abort();
      stopped = false;
      backoffMs = INITIAL_BACKOFF_MS;
      reconnectAttempts = 0;
      void connect();
    },
    stop() {
      stopped = true;
      if (backoffTimer !== null) {
        clearTimeout(backoffTimer);
        backoffTimer = null;
      }
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        // Deliver buffered events now so stopping drops nothing.
        flushBurst();
      }
      abortController?.abort();
      abortController = null;
      callbacks.onStatusChange("disconnected");
    },
  };
}
