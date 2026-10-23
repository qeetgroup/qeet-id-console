import {
  openEventStream,
  readServerSentEvents,
  type ServerSentEvent,
} from "@/platform/api/event-stream";
import { ApiError } from "@/platform/errors/api-error";

import type { ActivityEvent } from "./types/activity.types";

/**
 * Reads one server-sent event as an ActivityEvent. Returns null for other event types and for
 * malformed or id-less JSON.
 */
export function parseActivityEvent(message: ServerSentEvent): ActivityEvent | null {
  if (message.event !== "activity") return null;
  try {
    const data = JSON.parse(message.data) as Partial<ActivityEvent>;
    if (typeof data.id !== "string" || !data.id) return null;
    if (typeof data.type !== "string") return null;
    // Only id and type are checked; the backend owns the full schema.
    return data as ActivityEvent;
  } catch {
    return null;
  }
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
  onLastEventId: (id: string) => void; // each new SSE frame id, the server's resume cursor
};

/**
 * Returns a `start()`/`stop()` client for the activity SSE stream. It delivers events in short
 * bursts, reconnects with exponential backoff and resumes from Last-Event-ID. `stop()` aborts
 * any in-flight fetch and flushes buffered events.
 */
export function createActivityStream(
  callbacks: ActivityStreamCallbacks,
  resumeFrom: string | null = null, // a frame id from an earlier stream, to replay what it missed
) {
  let stopped = false;
  let abortController: AbortController | null = null;
  let backoffMs = INITIAL_BACKOFF_MS;
  let backoffTimer: ReturnType<typeof setTimeout> | null = null;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let burstBuffer: ActivityEvent[] = [];
  let lastEventId: string | null = resumeFrom;
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

  async function connect() {
    if (stopped) return;

    abortController = new AbortController();
    const { signal } = abortController;

    callbacks.onStatusChange("reconnecting");

    let body: ReadableStream<Uint8Array>;
    try {
      body = await openEventStream("/api/activity-stream", { lastEventId, signal });
    } catch (err) {
      if (stopped || signal.aborted) return;
      // The session is gone (the person has been signed out) or belongs to another scope:
      // nothing to reconnect to. Anything else, an undeployed backend included, retries quietly.
      if (err instanceof ApiError && (err.status === 401 || err.code === "client.stale_scope")) {
        return;
      }
      scheduleReconnect();
      return;
    }

    backoffMs = INITIAL_BACKOFF_MS;
    reconnectAttempts = 0;
    callbacks.onStatusChange("connected");

    try {
      for await (const message of readServerSentEvents(body)) {
        if (stopped) break;
        // Remembered so a reconnect resumes from here via Last-Event-ID.
        if (message.id && message.id !== lastEventId) {
          lastEventId = message.id;
          callbacks.onLastEventId(message.id);
        }
        const event = parseActivityEvent(message);
        if (event) scheduleFlush(event);
      }
    } catch {
      if (stopped || signal.aborted) return;
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
