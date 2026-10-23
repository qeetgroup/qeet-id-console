// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { PublicSession } from "@/platform/auth/server-session";
import { sessionStore } from "@/platform/auth/session-store";
import type { ToolExecution } from "@/modules/qeetai/tools/types/tool.types";
import {
  conversationActions,
  conversationStore,
  hydrateConversations,
} from "../conversation-store";

const SESSION: PublicSession = {
  isAuthenticated: true,
  expiresAt: "2030-01-01T00:00:00Z",
  sessionId: "session-a",
  userId: "user-a",
  tenantId: "tenant-1",
  version: 1,
  impersonationActor: null,
};
const STORE_KEY = "qeetid.qeetai.conversations:user-a:tenant-1";

function persistedState() {
  return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "{}");
}

beforeEach(() => {
  window.localStorage.clear();
  act(() => sessionStore.hydrate(SESSION));
  hydrateConversations();
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

    const liveExec = conversationStore.state.conversations[0]?.messages[0]?.toolExecutions?.[0];
    expect(liveExec?.result?.sensitiveArtifact?.value).toBe("SUPER-SECRET");

    const raw = window.localStorage.getItem(STORE_KEY) ?? "";
    expect(raw).not.toContain("SUPER-SECRET");
    expect(raw).not.toContain("owner@acme.io");
    expect(raw).not.toContain("10.1.2.3");

    const persistedExec = persistedState().conversations[0].messages[0].toolExecutions[0];
    expect(persistedExec.result.sensitiveArtifact).toBeUndefined();
    expect(persistedExec.result.summary).toContain("[redacted-email]");
    expect(persistedExec.result.data.contact).toBe("[redacted-email]");
  });

  it("masks PII in persisted message content (in-memory keeps it)", () => {
    conversationActions.appendMessage({
      role: "user",
      content: "reset the account for owner@acme.io on 10.1.2.3",
    });
    expect(conversationStore.state.conversations[0]?.messages[0]?.content).toContain(
      "owner@acme.io",
    );
    const raw = window.localStorage.getItem(STORE_KEY) ?? "";
    expect(raw).not.toContain("owner@acme.io");
    expect(raw).not.toContain("10.1.2.3");
    expect(persistedState().conversations[0].messages[0].content).toContain("[redacted-email]");
  });

  it("clearAll wipes conversations from memory and storage", () => {
    conversationActions.appendMessage({ role: "user", content: "hi" });
    expect(conversationStore.state.conversations.length).toBe(1);
    conversationActions.clearAll();
    expect(conversationStore.state.conversations).toEqual([]);
    expect(window.localStorage.getItem(STORE_KEY)).toBeNull();
  });

  it("replaces secret-keyed values in persisted tool input, keeping secret metadata", () => {
    const { conversationId, messageId } = conversationActions.appendMessage({
      role: "assistant",
      content: "creating",
    });
    const exec: ToolExecution = {
      id: "call_2",
      toolName: "create_user",
      input: {
        email: "new@acme.io",
        password: "Hunter2-correct-horse",
        tenant_id: "tenant-1",
        policy: { password_min_length: 12, otp_enabled: true },
      },
      status: "cancelled",
      startedAt: 1,
      endedAt: 2,
      attempts: 0,
    };
    conversationActions.upsertMessageExecution(conversationId, messageId, exec);

    const raw = window.localStorage.getItem(STORE_KEY) ?? "";
    expect(raw).not.toContain("Hunter2-correct-horse");
    const input = persistedState().conversations[0].messages[0].toolExecutions[0].input;
    expect(input.password).toBe("[redacted]");
    expect(input.tenant_id).toBe("tenant-1");
    expect(input.policy).toEqual({ password_min_length: 12, otp_enabled: true });
  });
});

describe("conversation-store loading", () => {
  it("restores the signed-in person's history after a reload", () => {
    conversationActions.appendMessage({ role: "user", content: "tenant one question" });
    conversationStore.setState(() => ({ conversations: [], activeId: null }));

    hydrateConversations();

    expect(conversationStore.state.conversations[0]?.messages[0]?.content).toBe(
      "tenant one question",
    );
  });

  it("ignores a saved payload from another storage version", () => {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ conversations: [{ id: "c1" }] }));

    hydrateConversations();

    expect(conversationStore.state.conversations).toEqual([]);
  });

  it("drops conversations past the retention period", () => {
    const stale = Date.now() - 31 * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        version: 2,
        activeId: "old",
        conversations: [
          {
            id: "old",
            title: "old",
            messages: [],
            pinned: false,
            createdAt: stale,
            updatedAt: stale,
          },
          {
            id: "new",
            title: "new",
            messages: [],
            pinned: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      }),
    );

    hydrateConversations();

    expect(conversationStore.state.conversations.map((c) => c.id)).toEqual(["new"]);
    expect(conversationStore.state.activeId).toBeNull();
  });
});
