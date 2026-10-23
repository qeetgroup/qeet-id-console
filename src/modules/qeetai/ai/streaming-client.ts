import { openEventStream, readServerSentEvents } from "@/platform/api/event-stream";
import { ApiError } from "@/platform/errors/api-error";
import { errorMessage } from "@/platform/errors/user-message";

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

function parseData(data: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(data);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Streams one turn through the same-origin `/api/qeetai-stream` proxy as StreamEvents. A
 * refusal or a dropped stream ends with an error event and `done: error`; an aborted turn ends
 * with `done: stopped`.
 */
export async function* streamQeetAITurn(
  path: string,
  body: unknown,
  signal: AbortSignal,
): AsyncIterable<StreamEvent> {
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await openEventStream("/api/qeetai-stream", {
      method: "POST",
      query: { path: path.startsWith("/") ? path : `/${path}` },
      body,
      signal,
    });
  } catch (err) {
    if (signal.aborted) {
      yield { type: "done", reason: "stopped" };
      return;
    }
    if (err instanceof ApiError) {
      // Copy keyed on the code; the body's message is backend text.
      yield { type: "error", code: err.code, message: errorMessage(err) };
    } else {
      yield { type: "error", code: "network_error", message: "Could not reach Qeet AI." };
    }
    yield { type: "done", reason: "error" };
    return;
  }

  try {
    for await (const message of readServerSentEvents(stream)) {
      const data = parseData(message.data);
      const event = data && mapEvent(message.event, data);
      if (event) yield event;
    }
  } catch {
    if (signal.aborted) {
      yield { type: "done", reason: "stopped" };
      return;
    }
    yield { type: "error", code: "stream_error", message: "The response stream was interrupted." };
    yield { type: "done", reason: "error" };
  }
}
