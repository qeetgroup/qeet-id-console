import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  data: { accessToken: "access-secret", refreshToken: "refresh-secret" } as Record<string, string>,
}));
vi.mock("@/platform/auth/server-session", () => ({ readServerSession: async () => session.data }));
vi.mock("@/platform/api/server-proxy", () => ({
  getServerApiBaseUrl: () => "https://api.qeet.test",
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestIP: () => "198.51.100.7" }));

import { proxyActivityStream, proxyQeetAIStream } from "../server-stream";

const fetchMock = vi.fn();
const CONVERSATION = "/v1/qeetai/conversations/0b6e9a4c-1d2f-4a3b-9c8d-7e6f5a4b3c2d/messages";

function backendStream(headers: Record<string, string> = {}) {
  return new Response("event: token\ndata: {}\n\n", {
    status: 200,
    headers: { "Content-Type": "text/event-stream", ...headers },
  });
}

beforeEach(() => {
  session.data = { accessToken: "access-secret", refreshToken: "refresh-secret" };
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(backendStream({ "X-Request-Id": "req-backend" }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("proxyActivityStream", () => {
  it("attaches the session's token server-side and resumes from the browser's last event", async () => {
    const res = await proxyActivityStream(
      new Request("https://console.test/api/activity-stream", {
        headers: { "Last-Event-ID": "cursor-9", "X-Request-Id": "req-browser" },
      }),
    );

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("https://api.qeet.test/v1/activity/stream");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer access-secret",
      Accept: "text/event-stream",
      "Last-Event-ID": "cursor-9",
      "X-Request-Id": "req-browser",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-store, no-transform");
    expect(res.headers.get("X-Request-Id")).toBe("req-backend");
  });

  it("refuses without a session and never calls the backend", async () => {
    session.data = {};
    const res = await proxyActivityStream(new Request("https://console.test/api/activity-stream"));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "auth.session_required" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never hands the access token back to the browser", async () => {
    const res = await proxyActivityStream(new Request("https://console.test/api/activity-stream"));
    expect(JSON.stringify([...res.headers])).not.toContain("access-secret");
  });
});

describe("proxyQeetAIStream", () => {
  it("forwards a turn to its conversation with the body as JSON", async () => {
    const url = `https://console.test/api/qeetai-stream?path=${encodeURIComponent(CONVERSATION)}`;
    await proxyQeetAIStream(new Request(url, { method: "POST", body: '{"text":"hi"}' }));

    const [target, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(target)).toBe(`https://api.qeet.test${CONVERSATION}`);
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"text":"hi"}');
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
  });

  it.each([
    ["no path", ""],
    ["another endpoint", "/v1/users"],
    ["a path outside the conversation", "/v1/qeetai/conversations/not-a-uuid/messages"],
  ])("refuses %s without calling the backend", async (_name, path) => {
    const url = `https://console.test/api/qeetai-stream${path ? `?path=${encodeURIComponent(path)}` : ""}`;
    const res = await proxyQeetAIStream(new Request(url, { method: "POST", body: "{}" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "client.invalid_stream_path" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
