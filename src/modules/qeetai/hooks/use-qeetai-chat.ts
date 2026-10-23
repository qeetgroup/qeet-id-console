import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import i18n from "@/i18n";
import { useCapabilities } from "@/platform/security/capability-provider";

import type { SendInput, ToolResultInput } from "../ai/ai-provider";
import { useActiveProvider } from "../ai/use-active-provider";
import { useConsoleContext } from "../context/use-console-context";
import { useQeetAIRuntime } from "../qeetai-provider";
import { redactPII } from "../redact";
import { conversationActions, conversationStore } from "../store/conversation-store";
import { secretsActions } from "../store/secrets-store";
import { changeRefusal, enabledTools, executeTool, getTool, isWithheldChange } from "../tools";
import type { ToolContext, ToolDefinition, ToolExecution } from "../tools/types/tool.types";

/** Hard cap on tool-use round-trips per turn, guarding against runaway loops. */
const MAX_TOOL_LEGS = 8;

type DoneReason = "end_turn" | "tool_use" | "stopped" | "error";
interface PendingToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface UseQeetAIChat {
  isStreaming: boolean;
  isThinking: boolean; // True between send and the first streamed token
  send: (text: string) => void;
  regenerate: () => void;
  editAndResend: (messageId: string, text: string) => void;
  stop: () => void;
}

/** Returns the redacted, model-safe tool result to post back for a settled execution. */
function toToolResult(exec: ToolExecution): ToolResultInput {
  if (exec.status === "succeeded" && exec.result) {
    return {
      toolCallId: exec.id,
      name: exec.toolName,
      // Never the sensitiveArtifact, and with emails and IPs masked before the model sees them.
      output: redactPII({ summary: exec.result.summary, ...(exec.result.data ?? {}) }),
    };
  }
  return {
    toolCallId: exec.id,
    name: exec.toolName,
    error: exec.error ?? { code: "tool_failed", message: "The tool did not complete." },
  };
}

/** Why a requested tool won't run: unknown, a withheld change, or no permission. */
function refusal(name: string, tool: ToolDefinition | undefined): ToolExecution["error"] {
  if (!tool) return { code: "unknown_tool", message: `Unknown tool: ${name}` };
  if (isWithheldChange(tool)) return changeRefusal(tool);
  return {
    code: "tool_not_enabled",
    message: `The "${name}" tool isn't available with your current permissions.`,
  };
}

/**
 * Saves an execution to the conversation store after moving any secret to the in-memory
 * secrets store: the conversation store persists to localStorage, which must never hold one.
 */
function recordExecution(conversationId: string, messageId: string, exec: ToolExecution) {
  let safe = exec;
  if (exec.result?.sensitiveArtifact) {
    secretsActions.set(exec.id, exec.result.sensitiveArtifact);
    safe = { ...exec, result: { ...exec.result, sensitiveArtifact: undefined } };
  }
  conversationActions.upsertMessageExecution(conversationId, messageId, safe);
}

/**
 * Runs conversation turns. When the model pauses with `tool_use`, the requested tools run
 * client-side under the operator's own session and their redacted results continue the turn,
 * at most MAX_TOOL_LEGS times. `stop` aborts both the stream and any running tool.
 */
export function useQeetAIChat(): UseQeetAIChat {
  const provider = useActiveProvider();
  const context = useConsoleContext();
  const access = useCapabilities();
  const queryClient = useQueryClient();
  const { confirm, stepUp } = useQeetAIRuntime();
  const [isStreaming, setStreaming] = useState(false);
  const [isThinking, setThinking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runTurn = useCallback(
    (conversationId: string, userText: string) => {
      const { messageId: assistantId } = conversationActions.appendMessage({
        role: "assistant",
        content: "",
        status: "streaming",
        contextPath: context.route.pathname,
      });

      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);
      setThinking(true);

      const toolCtx: ToolContext = {
        tenantId: context.tenantId ?? "",
        userId: context.userId ?? "",
        console: context,
        can: access.can,
        queryClient,
        signal: controller.signal,
        confirm,
        stepUp,
      };

      // getTool resolves any registered tool, so also gate on the enabled set: the model can't run
      // a tool beyond the operator's capabilities, or a withheld change. The backend still decides.
      const enabled = new Set(enabledTools(access.can).map((t) => t.name));

      const streamLeg = async (
        input: SendInput,
      ): Promise<{ calls: PendingToolCall[]; reason: DoneReason }> => {
        const calls: PendingToolCall[] = [];
        let reason: DoneReason = "end_turn";
        for await (const event of provider.send(input, { signal: controller.signal })) {
          switch (event.type) {
            case "thinking":
              setThinking(true);
              break;
            case "token":
              setThinking(false);
              conversationActions.appendChunk(conversationId, assistantId, event.text);
              break;
            case "tool_call":
              setThinking(false);
              calls.push({ id: event.id, name: event.name, input: event.input });
              break;
            case "error":
              conversationActions.updateMessage(conversationId, assistantId, {
                status: "error",
                error: event.message,
              });
              reason = "error";
              break;
            case "done":
              reason = event.reason;
              break;
            default:
              break;
          }
        }
        return { calls, reason };
      };

      void (async () => {
        try {
          let input: SendInput = { conversationId, message: userText, context };

          for (let leg = 0; leg < MAX_TOOL_LEGS; leg++) {
            const { calls, reason } = await streamLeg(input);

            if (reason === "stopped") {
              conversationActions.updateMessage(conversationId, assistantId, {
                status: "cancelled",
              });
              return;
            }
            if (reason === "error") return; // message already marked errored
            if (reason !== "tool_use" || calls.length === 0) {
              conversationActions.updateMessage(conversationId, assistantId, {
                status: "complete",
              });
              return;
            }

            const results: ToolResultInput[] = [];
            for (const call of calls) {
              if (controller.signal.aborted) break;
              const tool = getTool(call.name);
              let exec: ToolExecution;
              if (!tool || !enabled.has(tool.name)) {
                exec = {
                  id: call.id,
                  toolName: call.name,
                  input: call.input,
                  status: "failed",
                  startedAt: Date.now(),
                  endedAt: Date.now(),
                  attempts: 1,
                  error: refusal(call.name, tool),
                };
                recordExecution(conversationId, assistantId, exec);
              } else {
                exec = await executeTool(tool, call.input, toolCtx, {
                  id: call.id,
                  onTransition: (e) => recordExecution(conversationId, assistantId, e),
                });
              }
              results.push(toToolResult(exec));
            }

            if (controller.signal.aborted) {
              conversationActions.updateMessage(conversationId, assistantId, {
                status: "cancelled",
              });
              return;
            }
            input = { conversationId, toolResults: results, context };
          }

          // Out of tool legs: settle the turn as it stands rather than loop.
          conversationActions.updateMessage(conversationId, assistantId, { status: "complete" });
        } catch {
          conversationActions.updateMessage(conversationId, assistantId, {
            status: "error",
            error: i18n.t("qeetai:chat.turnFailed"),
          });
        } finally {
          if (abortRef.current === controller) abortRef.current = null;
          setStreaming(false);
          setThinking(false);
        }
      })();
    },
    [provider, context, access.can, queryClient, confirm, stepUp],
  );

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || abortRef.current) return;
      const { conversationId } = conversationActions.appendMessage({
        role: "user",
        content: text,
        contextPath: context.route.pathname,
      });
      runTurn(conversationId, text);
    },
    [context.route.pathname, runTurn],
  );

  const regenerate = useCallback(() => {
    if (abortRef.current) return;
    const { activeId, conversations } = conversationStore.state;
    const conv = conversations.find((c) => c.id === activeId);
    if (!conv) return;
    const lastUser = [...conv.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    conversationActions.truncateAfter(conv.id, lastUser.id);
    runTurn(conv.id, lastUser.content);
  }, [runTurn]);

  const editAndResend = useCallback(
    (messageId: string, raw: string) => {
      const text = raw.trim();
      if (!text || abortRef.current) return;
      const convId = conversationStore.state.activeId;
      if (!convId) return;
      conversationActions.editUserMessage(convId, messageId, text);
      runTurn(convId, text);
    },
    [runTurn],
  );

  return { isStreaming, isThinking, send, regenerate, editAndResend, stop };
}
