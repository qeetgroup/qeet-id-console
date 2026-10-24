// Idle sign-out across tabs: each tab records its newest activity, a bare timestamp, where the
// others read it, so an idle tab never signs out an operator working in another. UX only: the
// server's own idle limit stays authoritative.

const LAST_ACTIVITY_KEY = "qeetid.last-activity";
const WRITE_INTERVAL_MS = 15_000; // at most one storage write per tab in this window
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
] as const;

/** Returns the newest activity any tab recorded, or null when there is none or it can't be read. */
export function readSharedActivity(now: number): number | null {
  if (typeof window === "undefined") return null;
  try {
    const value = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY));
    // A time in the future would hold every tab signed in, so it doesn't count.
    return Number.isFinite(value) && value > 0 && value <= now ? value : null;
  } catch {
    return null; // storage disabled: each tab goes by its own activity
  }
}

function writeSharedActivity(at: number) {
  try {
    const current = readSharedActivity(Date.now());
    if (current !== null && current >= at) return; // another tab recorded newer activity
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(at));
  } catch {
    // Storage disabled: the other tabs can't see this one's activity.
  }
}

interface WatchIdleOptions {
  timeoutMs: number;
  onIdle: () => void; // called once, after which watching stops
  target?: EventTarget; // where this tab's activity is heard; the window by default
}

/**
 * Calls `onIdle` once no tab has seen activity for `timeoutMs`, and shares this tab's activity
 * with the others. Starting counts as activity. Returns a function that stops watching; on the
 * server it does nothing.
 */
export function watchIdle({ timeoutMs, onIdle, target }: WatchIdleOptions): () => void {
  if (typeof window === "undefined") return () => {};
  const source = target ?? window;
  let lastActivity = Date.now();
  let lastWrite = Number.NEGATIVE_INFINITY;
  let checkTimer: ReturnType<typeof setTimeout> | undefined;
  let writeTimer: ReturnType<typeof setTimeout> | undefined;

  const record = () => {
    writeTimer = undefined;
    lastWrite = Date.now();
    writeSharedActivity(lastActivity);
  };

  const onActivity = () => {
    lastActivity = Date.now();
    // A pending trailing write will carry this activity, so the newest always reaches the others.
    if (writeTimer !== undefined) return;
    const wait = lastWrite + WRITE_INTERVAL_MS - lastActivity;
    if (wait <= 0) record();
    else writeTimer = setTimeout(record, wait);
  };

  const stop = () => {
    clearTimeout(checkTimer);
    for (const event of ACTIVITY_EVENTS) source.removeEventListener(event, onActivity);
    if (writeTimer === undefined) return;
    clearTimeout(writeTimer);
    record();
  };

  // Re-arms for the newest activity seen in any tab instead of resetting on every event.
  const check = () => {
    const now = Date.now();
    const newest = Math.max(lastActivity, readSharedActivity(now) ?? 0);
    const remaining = newest + timeoutMs - now;
    if (remaining > 0) {
      checkTimer = setTimeout(check, remaining);
      return;
    }
    stop();
    onIdle();
  };

  for (const event of ACTIVITY_EVENTS) {
    source.addEventListener(event, onActivity, { passive: true });
  }
  onActivity();
  checkTimer = setTimeout(check, timeoutMs);
  return stop;
}
