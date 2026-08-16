// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import type { ToolExecution } from "../tools/tool-types";
import { conversationActions, conversationStore } from "./conversation-store";

const STORE_KEY = "qeetid.qeetai.conversations";

function persistedState() {
  return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "{}");
}

beforeEach(() => {
  window.localStorage.clear();
  conversationActions.clearAll();
});

describe("conversation-store persistence sanitization", () => {
  it("never writes secret artifacts to localStorage and masks PII", () => {
    const { conversationId, messageId } = conversationActions.appendMessage({
      role: "assistant",
      content: "created",
    });
    const exec: ToolExecution = {
      id: "call_1",
      toolName: "create_oauth_client",
      input: { email: "owner@acme.io" },
      status: "succeeded",
      startedAt: 1,
      endedAt: 2,
      attempts: 1,
      result: {
        ok: true,
        summary: "Created client for owner@acme.io from 10.1.2.3",
        data: { contact: "owner@acme.io" },
        sensitiveArtifact: { kind: "secret", label: "client_secret", value: "SUPER-SECRET" },
      },
    };
    conversationActions.upsertMessageExecution(conversationId, messageId, exec);

    // In-memory store keeps the full data (operator's own screen).
    const liveExec = conversationStore.state.conversations[0].messages[0].toolExecutions?.[0];
    expect(liveExec?.result?.sensitiveArtifact?.value).toBe("SUPER-SECRET");

    // Persisted copy is stripped + redacted.
    const raw = window.localStorage.getItem(STORE_KEY) ?? "";
    expect(raw).not.toContain("SUPER-SECRET");
    expect(raw).not.toContain("owner@acme.io");
    expect(raw).not.toContain("10.1.2.3");

    const persistedExec = persistedState().conversations[0].messages[0].toolExecutions[0];
    expect(persistedExec.result.sensitiveArtifact).toBeUndefined();
    expect(persistedExec.result.summary).toContain("[redacted-email]");
    expect(persistedExec.result.data.contact).toBe("[redacted-email]");
  });

  it("clearAll wipes conversations from memory and storage", () => {
    conversationActions.appendMessage({ role: "user", content: "hi" });
    expect(conversationStore.state.conversations.length).toBe(1);
    conversationActions.clearAll();
    expect(conversationStore.state.conversations).toEqual([]);
    expect(persistedState().conversations).toEqual([]);
  });
});
