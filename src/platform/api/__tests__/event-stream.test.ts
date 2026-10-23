// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sessionStore } from "@/platform/auth/session-store";
import { ApiError } from "@/platform/errors/api-error";

const { clearBrowserSession, refreshSessionForRequest } = vi.hoisted(() => ({
  clearBrowserSession: vi.fn(async () => undefined),
  refreshSessionForRequest: vi.fn(async () => true),
}));
vi.mock("@/platform/api/client", () => ({ clearBrowserSession, refreshSessionForRequest }));

import { openEventStream, readServerSentEvents, type ServerSentEvent } from "../event-stream";

function bodyOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function eventsOf(...chunks: string[]): Promise<ServerSentEvent[]> {
  const events: ServerSentEvent[] = [];
  for await (const event of readServerSentEvents(bodyOf(...chunks))) events.push(event);
  return events;
}

function stream(text = "") {
  return new Response(text, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function refusal(status: number, error?: Record<string, unknown>) {
  return new Response(error ? JSON.stringify({ error }) : "", { status });
}

describe("readServerSentEvents", () => {
  it("dispatches each event at its blank line, joining multi-line data", async () => {
    expect(await eventsOf("event: token\ndata: a\ndata: b\n\ndata: c\n\n")).toEqual([
      { event: "token", data: "a\nb", id: undefined },
      { event: "message", data: "c", id: undefined },
    ]);
  });

  it("accepts \\r\\n and \\r line endings, even when split across chunks", async () => {
    expect(await eventsOf("data: one\r", "\n\r", "\ndata: two\r\r")).toEqual([
      { event: "message", data: "one", id: undefined },
      { event: "message", data: "two", id: undefined },
    ]);
  });

  it("skips comments and data-less events, and strips only one leading space", async () => {
    expect(await eventsOf(": keep-alive\n\nevent: ping\n\ndata:  padded\n\n")).toEqual([
      { event: "message", data: " padded", id: undefined },
    ]);
  });

  it("carries the last id forward so a reconnect can resume", async () => {
    const events = await eventsOf("id: 1\ndata: a\n\ndata: b\n\nid: 2\ndata: c\n\n");
    expect(events.map((event) => event.id)).toEqual(["1", "1", "2"]);
  });

  it("discards an event cut off by the end of the stream", async () => {
    expect(await eventsOf("data: complete\n\ndata: cut off")).toEqual([
      { event: "message", data: "complete", id: undefined },
    ]);
  });
});

describe("openEventStream", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    refreshSessionForRequest.mockReset();
    refreshSessionForRequest.mockResolvedValue(true);
    clearBrowserSession.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("opens the same-origin route with a request id and the resume point", async () => {
    fetchMock.mockResolvedValue(stream());

    await openEventStream("/api/qeetai-stream", {
      method: "POST",
      query: { path: "/v1/qeetai/conversations/x/messages" },
      body: { text: "hi" },
      lastEventId: "cursor-1",
      signal: new AbortController().signal,
    });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe("/api/qeetai-stream");
    expect(url.searchParams.get("path")).toBe("/v1/qeetai/conversations/x/messages");
    expect(init.body).toBe(JSON.stringify({ text: "hi" }));
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "Last-Event-ID": "cursor-1",
      "X-Request-Id": expect.any(String),
    });
  });

  it("renews the session after a 401 and resends once", async () => {
    fetchMock.mockResolvedValueOnce(refusal(401)).mockResolvedValueOnce(stream());

    await openEventStream("/api/activity-stream", { signal: new AbortController().signal });

    expect(refreshSessionForRequest).toHaveBeenCalledWith(expect.any(AbortSignal), true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(clearBrowserSession).not.toHaveBeenCalled();
  });

  it("signs out without a refresh when the backend says the session ended", async () => {
    fetchMock.mockResolvedValue(refusal(401, { code: "auth.session_revoked" }));

    const err = await openEventStream("/api/activity-stream", {
      signal: new AbortController().signal,
    }).catch((e: unknown) => e);

    expect(err).toMatchObject({ status: 401, code: "auth.session_revoked" });
    expect(refreshSessionForRequest).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(clearBrowserSession).toHaveBeenCalledOnce();
  });

  it("signs out when the session can't be renewed", async () => {
    refreshSessionForRequest.mockResolvedValue(false);
    fetchMock.mockResolvedValue(refusal(401));

    const err = await openEventStream("/api/activity-stream", {
      signal: new AbortController().signal,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, code: "auth.session_expired" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(clearBrowserSession).toHaveBeenCalledOnce();
  });

  it("throws a refusal's code and request id, never its message", async () => {
    fetchMock.mockResolvedValue(
      refusal(503, {
        code: "qeetai.unavailable",
        message: "dial tcp 10.0.3.7",
        request_id: "req-9",
      }),
    );

    const err = await openEventStream("/api/activity-stream", {
      signal: new AbortController().signal,
    }).catch((e: unknown) => e);

    expect(err).toMatchObject({ status: 503, code: "qeetai.unavailable", requestId: "req-9" });
    expect((err as Error).message).not.toContain("10.0.3.7");
  });

  it("refuses a stream that outlived its session scope", async () => {
    fetchMock.mockImplementation(async () => {
      sessionStore.set({
        isAuthenticated: true,
        expiresAt: "2030-01-01T00:00:00Z",
        sessionId: `session-${Math.random()}`,
        userId: "user-2",
        tenantId: "tenant-2",
        version: 1,
        impersonationActor: null,
      });
      return stream();
    });

    await expect(
      openEventStream("/api/activity-stream", { signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: "client.stale_scope" });
  });
});
