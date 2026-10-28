// The model seam: a provider yields a typed async stream, so the conversation UI doesn't depend
// on the transport (the backend's SSE today; a fake one in tests).

import type { ConsoleContext } from "../context/types/context.types";

/**
 * Everything one turn can emit. `done.reason` tells a finished answer (`end_turn`) from a pause
 * for client-side tools (`tool_use`).
 */
export type StreamEvent =
  | { type: "thinking"; text?: string }
  | { type: "token"; text: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | {
      type: "tool_result";
      id: string;
      name: string;
      status: "succeeded" | "failed";
      summary: string;
    }
  | { type: "error"; code: string; message: string }
  | { type: "done"; reason: "end_turn" | "tool_use" | "stopped" | "error"; messageId?: string };

/** Result of a client-executed tool, posted back to continue the turn. */
export interface ToolResultInput {
  toolCallId: string;
  name: string;
  output?: unknown;
  error?: { code: string; message: string };
}

/**
 * A new user message, or the results of the tools the model requested. `context` grounds the
 * model, and the server treats it as untrusted.
 */
export interface SendInput {
  conversationId: string;
  message?: string;
  toolResults?: ToolResultInput[];
  context: ConsoleContext;
}

export interface ProviderStatus {
  configured: boolean;
  provider?: string;
  model?: string;
}

export interface AIProvider {
  readonly id: string; // Stable identifier, e.g. "backend"
  /** Reports whether a model is configured. */
  status(signal?: AbortSignal): Promise<ProviderStatus>;
  /** Streams a turn; must stop when `opts.signal` aborts. */
  send(input: SendInput, opts: { signal: AbortSignal }): AsyncIterable<StreamEvent>;
}

/** Thrown when a turn's AbortSignal aborts; treated as a cancel, not a failure. */
export class ChatAbortError extends Error {
  constructor() {
    super("Generation stopped");
    this.name = "ChatAbortError";
  }
}
