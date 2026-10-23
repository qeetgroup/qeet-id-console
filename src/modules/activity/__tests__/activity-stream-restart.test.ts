// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/platform/api/client", () => ({
  clearBrowserSession: vi.fn(),
  refreshSessionForRequest: vi.fn(async () => true),
}));

import { createActivityStream } from "../activity-stream";

afterEach(() => vi.unstubAllGlobals());

describe("createActivityStream restart", () => {
  it("replaces the live connection instead of opening a second one", async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: URL, init: RequestInit) => {
        if (init.signal) signals.push(init.signal);
        return new Promise<Response>(() => {}); // stays connected
      }),
    );
    const client = createActivityStream({
      onEvents: vi.fn(),
      onStatusChange: vi.fn(),
      onLastEventId: vi.fn(),
    });

    client.start();
    await vi.waitFor(() => expect(signals).toHaveLength(1));
    client.start();
    await vi.waitFor(() => expect(signals).toHaveLength(2));

    expect(signals.map((signal) => signal.aborted)).toEqual([true, false]);
    client.stop();
  });
});
