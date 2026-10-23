// Provider used while Qeet AI isn't usable: the workspace still works, and each turn streams an
// explanation of how to connect a provider instead of an answer.

import i18n from "@/i18n";

import { ASSISTANT_CHANGE_TOOLS_ENABLED } from "../tools/tool-registry";
import {
  type AIProvider,
  ChatAbortError,
  type ProviderStatus,
  type SendInput,
  type StreamEvent,
} from "./ai-provider";

/** The Markdown explanation each turn streams, in the operator's language. */
function setupMessage(): string {
  const abilities = [
    i18n.t("qeetai:unconfigured.answer"),
    // Promise only what this version can do: change tools may be switched off.
    ASSISTANT_CHANGE_TOOLS_ENABLED
      ? i18n.t("qeetai:unconfigured.act")
      : i18n.t("qeetai:unconfigured.lookUp"),
    i18n.t("qeetai:unconfigured.generate"),
  ];
  return [
    i18n.t("qeetai:unconfigured.notConnected"),
    i18n.t("qeetai:unconfigured.onceConnected"),
    abilities.map((ability) => `- ${ability}`).join("\n"),
    i18n.t("qeetai:unconfigured.audit"),
  ].join("\n\n");
}

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
      for (const piece of chunk(setupMessage())) {
        yield { type: "token", text: piece };
        await delay(12, signal);
      }
      yield { type: "done", reason: "end_turn" };
    } catch (err) {
      if (err instanceof ChatAbortError) {
        yield { type: "done", reason: "stopped" };
        return;
      }
      yield {
        type: "error",
        code: "unconfigured_stream_failed",
        message: i18n.t("qeetai:stream.interrupted"),
      };
    }
  },
};
