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

describe("createActivityStream resume point", () => {
  const event = {
    id: "8f14e45f-ceea-467f-a0e6-d2d1c4f3c2a1",
    type: "auth.login_succeeded",
    category: "authentication",
    severity: "success",
    title: "Auth Login Succeeded",
    at: "2026-10-23T10:00:00Z",
  };

  it("resumes from the SSE frame id, not the event's own id", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const sent: (string | undefined)[] = [];
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: URL, init: RequestInit) => {
        sent.push((init.headers as Record<string, string>)["Last-Event-ID"]);
        call++;
        if (call === 1) {
          // One event, then the connection drops.
          const frame = `id: cursor-7\nevent: activity\ndata: ${JSON.stringify(event)}\n\n`;
          return Promise.resolve(
            new Response(frame, { headers: { "Content-Type": "text/event-stream" } }),
          );
        }
        return new Promise<Response>(() => {});
      }),
    );
    const onLastEventId = vi.fn();
    const client = createActivityStream({
      onEvents: vi.fn(),
      onStatusChange: vi.fn(),
      onLastEventId,
    });

    client.start();
    await vi.waitFor(() => expect(onLastEventId).toHaveBeenCalledWith("cursor-7"));
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    expect(sent).toEqual([undefined, "cursor-7"]);
    client.stop();
    vi.useRealTimers();
  });

  it("carries on from an earlier stream's frame id", async () => {
    const sent: (string | undefined)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: URL, init: RequestInit) => {
        sent.push((init.headers as Record<string, string>)["Last-Event-ID"]);
        return new Promise<Response>(() => {});
      }),
    );
    const client = createActivityStream(
      { onEvents: vi.fn(), onStatusChange: vi.fn(), onLastEventId: vi.fn() },
      "cursor-3",
    );

    client.start();
    await vi.waitFor(() => expect(sent).toEqual(["cursor-3"]));
    client.stop();
  });
});
