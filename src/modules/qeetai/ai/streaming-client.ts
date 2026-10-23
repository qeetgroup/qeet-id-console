import { clearBrowserSession, refreshSessionForRequest } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";
import { errorMessage } from "@/platform/errors/user-message";
import { newRequestId } from "@/platform/telemetry/tracing";

import type { StreamEvent } from "./ai-provider";

function mapEvent(name: string, data: Record<string, unknown>): StreamEvent | null {
  switch (name) {
    case "thinking":
      return { type: "thinking", text: typeof data.text === "string" ? data.text : undefined };
    case "token":
      return { type: "token", text: typeof data.text === "string" ? data.text : "" };
    case "tool_call":
      return {
        type: "tool_call",
        id: String(data.id ?? ""),
        name: String(data.name ?? ""),
        input: data.input,
      };
    case "tool_result":
      return {
        type: "tool_result",
        id: String(data.id ?? ""),
        name: String(data.name ?? ""),
        status: data.status === "succeeded" ? "succeeded" : "failed",
        summary: typeof data.summary === "string" ? data.summary : "",
      };
    case "error": {
      // The frame's own message is backend text: show copy keyed on the code.
      const code = String(data.code ?? "error");
      return { type: "error", code, message: errorMessage(new ApiError(0, code, "")) };
    }
    case "done": {
      const reason = data.reason;
      return {
        type: "done",
        reason:
          reason === "tool_use" || reason === "stopped" || reason === "error" ? reason : "end_turn",
        messageId: typeof data.message_id === "string" ? data.message_id : undefined,
      };
    }
    default:
      return null;
  }
}

function parseFrame(frame: string): StreamEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith(":")) continue; // comment / keep-alive
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return mapEvent(event, JSON.parse(dataLines.join("\n")) as Record<string, unknown>);
  } catch {
    return null;
  }
}

/**
 * Streams one turn through the same-origin `/api/qeetai-stream` proxy as StreamEvents. Retries
 * once after a session refresh on 401; an aborted turn ends with `done: stopped`.
 */
export async function* streamQeetAITurn(
  path: string,
  body: unknown,
  signal: AbortSignal,
): AsyncIterable<StreamEvent> {
  const url = new URL("/api/qeetai-stream", window.location.origin);
  url.searchParams.set("path", path.startsWith("/") ? path : `/${path}`);

  const request = () =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "X-Request-Id": newRequestId(),
      },
      body: JSON.stringify(body),
      signal,
    });

  let res: Response;
  try {
    res = await request();
    if (res.status === 401 && (await refreshSessionForRequest(signal, true))) {
      res = await request();
    }
  } catch {
    if (signal.aborted) {
      yield { type: "done", reason: "stopped" };
      return;
    }
    yield { type: "error", code: "network_error", message: "Could not reach Qeet AI." };
    yield { type: "done", reason: "error" };
    return;
  }

  if (!res.ok || !res.body) {
    if (res.status === 401) await clearBrowserSession();
    let code = `http_${res.status}`;
    try {
      const parsed = (await res.json()) as { error?: { code?: string } };
      if (parsed?.error?.code) code = parsed.error.code;
    } catch {
      // non-JSON error body — keep the status-derived code
    }
    // Copy keyed on the code; the body's message is backend text.
    yield { type: "error", code, message: errorMessage(new ApiError(res.status, code, "")) };
    yield { type: "done", reason: "error" };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const event = parseFrame(frame);
        if (event) yield event;
        sep = buffer.indexOf("\n\n");
      }
    }
  } catch {
    if (signal.aborted) {
      yield { type: "done", reason: "stopped" };
      return;
    }
    yield { type: "error", code: "stream_error", message: "The response stream was interrupted." };
    yield { type: "done", reason: "error" };
    return;
  } finally {
    try {
      await reader.cancel();
    } catch {
      // reader already released
    }
  }
}
