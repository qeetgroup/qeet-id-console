// Builds the body of a backend `…/messages` request. The server owns the system prompt: the
// client sends only the user message or tool results (in snake_case) and grounding context.

import type { SendInput } from "./ai-provider";

export interface QeetAITurnBody {
  message?: string;
  tool_results?: {
    tool_call_id: string;
    name: string;
    output?: unknown;
    error?: { code: string; message: string };
  }[];
  context: unknown;
}

export function buildTurnBody(input: SendInput): QeetAITurnBody {
  return {
    message: input.message,
    tool_results: input.toolResults?.map((result) => ({
      tool_call_id: result.toolCallId,
      name: result.name,
      output: result.output,
      error: result.error,
    })),
    context: input.context,
  };
}
