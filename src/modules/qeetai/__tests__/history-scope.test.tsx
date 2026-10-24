// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicSession } from "@/platform/auth/server-session";
import { sessionStore } from "@/platform/auth/session-store";

vi.mock("@/platform/api/client", () => ({ api: vi.fn(async () => ({ items: [] })) }));

import { QeetAIRuntimeProvider } from "../qeetai-provider";
import { conversationStore } from "../store/conversation-store";

const SIGNED_OUT: PublicSession = {
  isAuthenticated: false,
  expiresAt: null,
  sessionId: null,
  userId: null,
  tenantId: null,
  version: 0,
  impersonationActor: null,
};

function session(userId: string): PublicSession {
  return {
    isAuthenticated: true,
    expiresAt: "2030-01-01T00:00:00Z",
    sessionId: `session-${userId}`,
    userId,
    tenantId: "tenant-1",
    version: 1,
    impersonationActor: null,
  };
}

const KEY_A = "qeetid.qeetai.conversations:user-a:tenant-1";

function saveHistoryFor(key: string, content: string) {
  const now = Date.now();
  window.localStorage.setItem(
    key,
    JSON.stringify({
      version: 2,
      activeId: "c1",
      conversations: [
        {
          id: "c1",
          title: content,
          pinned: false,
          createdAt: now,
          updatedAt: now,
          messages: [{ id: "m1", role: "user", content, status: "complete", createdAt: now }],
        },
      ],
    }),
  );
}

function mountConsole() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <QeetAIRuntimeProvider>
        <div />
      </QeetAIRuntimeProvider>
    </QueryClientProvider>,
  );
}

function shownContents() {
  return conversationStore.state.conversations.flatMap((c) => c.messages.map((m) => m.content));
}

beforeEach(() => {
  window.localStorage.clear();
  act(() => sessionStore.hydrate(SIGNED_OUT));
});

afterEach(cleanup);

// Each test mounts signed out, then hydrates the session, as the app layout does after its
// children's effects run on a hard reload.
describe("Qeet AI history across sessions", () => {
  it("keeps a person's saved history across a reload", async () => {
    saveHistoryFor(KEY_A, "question from a");
    mountConsole();

    act(() => sessionStore.hydrate(session("user-a")));

    await waitFor(() => expect(shownContents()).toEqual(["question from a"]));
    expect(window.localStorage.getItem(KEY_A)).not.toBeNull();
  });

  it("does not show the previous person's history to the next person", async () => {
    saveHistoryFor(KEY_A, "question from a");
    mountConsole();

    act(() => sessionStore.hydrate(session("user-b")));

    await waitFor(() => expect(conversationStore.state.conversations).toEqual([]));
  });

  it("wipes the saved history when the person signs out", async () => {
    saveHistoryFor(KEY_A, "question from a");
    mountConsole();
    act(() => sessionStore.hydrate(session("user-a")));
    await waitFor(() => expect(shownContents()).toEqual(["question from a"]));

    act(() => sessionStore.clear());

    expect(conversationStore.state.conversations).toEqual([]);
    expect(window.localStorage.getItem(KEY_A)).toBeNull();
  });
});
