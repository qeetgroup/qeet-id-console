// Provider used while Qeet AI isn't usable: the workspace still works, and each turn streams an
// explanation of how to connect a provider instead of an answer.

import {
  type AIProvider,
  ChatAbortError,
  type ProviderStatus,
  type SendInput,
  type StreamEvent,
} from "./ai-provider";

const SETUP_MESSAGE =
  "Qeet AI is ready, but no AI provider is connected for this organization yet.\n\n" +
  "Once an owner or admin adds an AI provider key under **Settings → Qeet AI** (or an operator sets a platform key on the Qeet ID server), I'll be able to:\n\n" +
  "- **Answer questions** about users, roles, policies, connections, and audit events in this tenant\n" +
  "- **Run actions as tools** — create users, rotate signing keys, simulate authorization, search audit logs — always through your own permissions, with a confirmation step before anything destructive\n" +
  "- **Generate** Terraform, SDK snippets, and API examples from your live configuration\n\n" +
  "Everything I do runs under your access and is written to the audit log. Nothing here bypasses authorization.";

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new ChatAbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new ChatAbortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Splits text into word-plus-whitespace chunks, so it streams at a model's cadence. */
function chunk(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [text];
}

export const unconfiguredProvider: AIProvider = {
  id: "unconfigured",

  async status(): Promise<ProviderStatus> {
    return { configured: false };
  },

  async *send(_input: SendInput, opts: { signal: AbortSignal }): AsyncIterable<StreamEvent> {
    const { signal } = opts;
    try {
      yield { type: "thinking" };
      await delay(120, signal);
      for (const piece of chunk(SETUP_MESSAGE)) {
        yield { type: "token", text: piece };
        await delay(12, signal);
      }
      yield { type: "done", reason: "end_turn" };
    } catch (err) {
      if (err instanceof ChatAbortError) {
        yield { type: "done", reason: "stopped" };
        return;
      }
      yield { type: "error", code: "unconfigured_stream_failed", message: "Stream failed" };
    }
  },
};
