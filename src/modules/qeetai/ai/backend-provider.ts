// Provider backed by the qeetai service: each turn streams over SSE. Conversations are
// local-first, so the server one is created on the first turn and its id kept on the local one.

import { api } from "@/platform/api/client";
import { createQeetAIConversation } from "../api/qeetai";

import { conversationActions, conversationStore } from "../store/conversation-store";
import type { AIProvider, ProviderStatus, SendInput, StreamEvent } from "./ai-provider";
import { buildTurnBody } from "./prompt-builder";
import { streamQeetAITurn } from "./streaming-client";

/** Returns the server conversation id for a local one, creating it if needed; null on failure. */
async function ensureServerConversation(localId: string): Promise<string | null> {
  const existing = conversationStore.state.conversations.find((c) => c.id === localId);
  if (existing?.serverId) return existing.serverId;
  try {
    const created = await createQeetAIConversation(existing?.title);
    conversationActions.setServerConversationId(localId, created.id);
    return created.id;
  } catch {
    return null;
  }
}

export const backendProvider: AIProvider = {
  id: "backend",

  status(signal) {
    return api<ProviderStatus>("/v1/qeetai/status", { signal });
  },

  async *send(input: SendInput, opts: { signal: AbortSignal }): AsyncIterable<StreamEvent> {
    const serverId = await ensureServerConversation(input.conversationId);
    if (!serverId) {
      yield {
        type: "error",
        code: "conversation_unavailable",
        message: "Could not open a conversation on the server.",
      };
      yield { type: "done", reason: "error" };
      return;
    }
    yield* streamQeetAITurn(
      `/v1/qeetai/conversations/${serverId}/messages`,
      buildTurnBody(input),
      opts.signal,
    );
  },
};
