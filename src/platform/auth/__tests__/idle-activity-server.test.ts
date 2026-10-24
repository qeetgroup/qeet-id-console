// Runs in the node environment: no `window`, as during SSR.
import { afterEach, describe, expect, it, vi } from "vitest";

import { readSharedActivity, watchIdle } from "../idle-activity";

afterEach(() => vi.useRealTimers());

describe("idle activity on the server", () => {
  it("reads no shared activity", () => {
    expect(readSharedActivity(Date.now())).toBeNull();
  });

  it("never watches, and never signs anyone out", () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();

    const stop = watchIdle({ timeoutMs: 1_000, onIdle });
    vi.advanceTimersByTime(60_000);
    stop();

    expect(onIdle).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
