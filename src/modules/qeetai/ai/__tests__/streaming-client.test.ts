// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StreamEvent } from "../ai-provider";
import { streamQeetAITurn } from "../streaming-client";

vi.mock("@/platform/api/client", () => ({
  clearBrowserSession: vi.fn(async () => undefined),
  refreshSessionForRequest: vi.fn(async () => true),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

async function collect(response: Response): Promise<StreamEvent[]> {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response),
  );
  const events: StreamEvent[] = [];
  for await (const event of streamQeetAITurn(
    "/v1/qeetai/turns",
    {},
    new AbortController().signal,
  )) {
    events.push(event);
  }
  return events;
}

const BACKEND_TEXT = "dial tcp 10.0.3.7:5432: connect: connection refused";

// Errors are shown in the conversation and persisted with it, so the
// backend's own message must be replaced by copy keyed on the code.
describe("streamQeetAITurn errors", () => {
  it("does not carry an error frame's backend message", async () => {
    const frame = `event: error\ndata: ${JSON.stringify({ code: "internal", message: BACKEND_TEXT })}\n\n`;
    const events = await collect(
      new Response(frame, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    );

    const error = events.find((event) => event.type === "error");
    expect(error).toMatchObject({
      code: "internal",
      message: "Something went wrong. Please try again.",
    });
    expect(JSON.stringify(events)).not.toContain("10.0.3.7");
  });

  it("does not carry a refused request's backend message", async () => {
    const events = await collect(
      new Response(JSON.stringify({ error: { code: "internal", message: BACKEND_TEXT } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(events[0]).toMatchObject({ type: "error", code: "internal" });
    expect(JSON.stringify(events)).not.toContain("10.0.3.7");
  });
});
