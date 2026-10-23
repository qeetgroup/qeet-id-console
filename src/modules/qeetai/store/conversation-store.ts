// Conversations and their messages, persisted through scopedStorage: a thread survives a
// reload, but one person's history never loads for another and is wiped on sign-out.

import { Store } from "@tanstack/react-store";

import { scopedStorage } from "@/platform/auth/scoped-storage";

import { maskPII, redactPII } from "../redact";
import type { ToolExecution } from "../tools/types/tool.types";
import type { Conversation, Message, MessageStatus } from "../types/qeetai.types";

const STORE_VERSION = 2;
const MAX_CONVERSATIONS = 100;
// Conversations untouched for this long are dropped on load and on save.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
// A persisted tool input or data blob larger than this is replaced by a `truncated` marker.
const MAX_BLOB_CHARS = 4000;

export interface ConversationState {
  conversations: Conversation[];
  activeId: string | null;
}

interface PersistedConversations extends ConversationState {
  version: number;
}

const EMPTY_STATE: ConversationState = { conversations: [], activeId: null };

const storage = scopedStorage("qeetid.qeetai.conversations", {
  // The old scope's history leaves memory before the new session is visible.
  onScopeChange: () => conversationStore.setState(() => EMPTY_STATE),
});

function withinRetention(conversations: Conversation[]): Conversation[] {
  const cutoff = Date.now() - RETENTION_MS;
  return conversations.filter((c) => typeof c.updatedAt === "number" && c.updatedAt >= cutoff);
}

export const conversationStore = new Store<ConversationState>({
  conversations: [],
  activeId: null,
});

function uid(prefix: string): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID)
      return `${prefix}_${crypto.randomUUID()}`;
  } catch {
    // fall through to the time-based id
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Returns a title for a conversation from its first user message. */
export function deriveTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "New conversation";
  return trimmed.length > 48 ? `${trimmed.slice(0, 47)}…` : trimmed;
}

function capBlob(value: unknown): unknown {
  try {
    if (JSON.stringify(value).length > MAX_BLOB_CHARS) return { truncated: true };
  } catch {
    // unserialisable — drop it
    return { truncated: true };
  }
  return value;
}

/** Returns an execution's persistable copy: PII redacted, oversized blobs capped. */
function sanitizeExecution(exec: ToolExecution): ToolExecution {
  const result = exec.result
    ? {
        ...exec.result,
        summary: maskPII(exec.result.summary),
        data: exec.result.data
          ? (capBlob(redactPII(exec.result.data)) as Record<string, unknown>)
          : undefined,
        // Already moved to the secrets store; cleared again so it can never reach localStorage.
        sensitiveArtifact: undefined,
      }
    : exec.result;
  return { ...exec, input: capBlob(redactPII(exec.input)), result };
}

/**
 * Returns the copy written to localStorage, redacted and size-capped, since any script or
 * extension can read it there. Memory keeps full tool data for the operator's own screen.
 */
function sanitizeForPersistence(state: ConversationState): ConversationState {
  return {
    ...state,
    conversations: state.conversations.map((c) => ({
      ...c,
      title: maskPII(c.title), // Titles come from the first user message, so they can carry PII too
      messages: c.messages.map((m) => ({
        ...m,
        content: maskPII(m.content),
        toolExecutions: m.toolExecutions?.map(sanitizeExecution),
      })),
    })),
  };
}

function persist(state: ConversationState) {
  const conversations = withinRetention(state.conversations);
  const payload: PersistedConversations = {
    version: STORE_VERSION,
    ...sanitizeForPersistence({
      conversations,
      activeId: conversations.some((c) => c.id === state.activeId) ? state.activeId : null,
    }),
  };
  storage.write(payload);
}

function touch(conversation: Conversation): Conversation {
  return { ...conversation, updatedAt: Date.now() };
}

/** Returns a sorted copy: pinned first, then most recently updated. */
export function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

export const conversationActions = {
  /** Creates an empty conversation and makes it active. */
  create(): string {
    const id = uid("conv");
    const now = Date.now();
    const conversation: Conversation = {
      id,
      title: "New conversation",
      messages: [],
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    conversationStore.setState((s) => {
      const conversations = [conversation, ...s.conversations].slice(0, MAX_CONVERSATIONS);
      const next = { conversations, activeId: id };
      persist(next);
      return next;
    });
    return id;
  },

  setServerConversationId(localId: string, serverId: string) {
    conversationStore.setState((s) => {
      const conversations = s.conversations.map((c) => (c.id === localId ? { ...c, serverId } : c));
      const next = { ...s, conversations };
      persist(next);
      return next;
    });
  },

  setActive(id: string | null) {
    conversationStore.setState((s) => {
      if (s.activeId === id) return s;
      const next = { ...s, activeId: id };
      persist(next);
      return next;
    });
  },

  /** Appends a message to the active conversation, creating one if there is none. */
  appendMessage(input: {
    role: Message["role"];
    content: string;
    status?: MessageStatus;
    contextPath?: string;
  }): { conversationId: string; messageId: string } {
    let conversationId = conversationStore.state.activeId;
    if (
      !conversationId ||
      !conversationStore.state.conversations.some((c) => c.id === conversationId)
    ) {
      conversationId = conversationActions.create();
    }
    const messageId = uid("msg");
    const message: Message = {
      id: messageId,
      role: input.role,
      content: input.content,
      status: input.status ?? "complete",
      createdAt: Date.now(),
      contextPath: input.contextPath,
    };
    conversationStore.setState((s) => {
      const conversations = s.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const titled =
          c.messages.length === 0 && input.role === "user"
            ? { ...c, title: deriveTitle(input.content) }
            : c;
        return touch({ ...titled, messages: [...titled.messages, message] });
      });
      const next = { ...s, conversations };
      persist(next);
      return next;
    });
    return { conversationId, messageId };
  },

  updateMessage(
    conversationId: string,
    messageId: string,
    patch: Partial<Pick<Message, "content" | "status" | "error">>,
  ) {
    conversationStore.setState((s) => {
      const conversations = s.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        return touch({
          ...c,
          messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
        });
      });
      const next = { ...s, conversations };
      persist(next);
      return next;
    });
  },

  appendChunk(conversationId: string, messageId: string, chunk: string) {
    conversationStore.setState((s) => {
      const conversations = s.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        return touch({
          ...c,
          messages: c.messages.map((m) =>
            m.id === messageId ? { ...m, content: m.content + chunk } : m,
          ),
        });
      });
      const next = { ...s, conversations };
      persist(next);
      return next;
    });
  },

  upsertMessageExecution(conversationId: string, messageId: string, exec: ToolExecution) {
    conversationStore.setState((s) => {
      const conversations = s.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        return touch({
          ...c,
          messages: c.messages.map((m) => {
            if (m.id !== messageId) return m;
            const existing = m.toolExecutions ?? [];
            const idx = existing.findIndex((e) => e.id === exec.id);
            const toolExecutions =
              idx === -1 ? [...existing, exec] : existing.map((e) => (e.id === exec.id ? exec : e));
            return { ...m, toolExecutions };
          }),
        });
      });
      const next = { ...s, conversations };
      persist(next);
      return next;
    });
  },

  /** Drops every message after `messageId`, keeping that one. */
  truncateAfter(conversationId: string, messageId: string) {
    conversationStore.setState((s) => {
      const conversations = s.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const idx = c.messages.findIndex((m) => m.id === messageId);
        if (idx === -1) return c;
        return touch({ ...c, messages: c.messages.slice(0, idx + 1) });
      });
      const next = { ...s, conversations };
      persist(next);
      return next;
    });
  },

  /** Replaces a user message's text and drops every message after it. */
  editUserMessage(conversationId: string, messageId: string, content: string) {
    const clean = content.trim();
    if (!clean) return;
    conversationStore.setState((s) => {
      const conversations = s.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const idx = c.messages.findIndex((m) => m.id === messageId);
        if (idx === -1) return c;
        const messages = c.messages
          .slice(0, idx + 1)
          .map((m) => (m.id === messageId ? { ...m, content: clean } : m));
        return touch({ ...c, messages });
      });
      const next = { ...s, conversations };
      persist(next);
      return next;
    });
  },

  rename(conversationId: string, title: string) {
    const clean = title.trim();
    if (!clean) return;
    conversationStore.setState((s) => {
      const conversations = s.conversations.map((c) =>
        c.id === conversationId ? { ...c, title: clean.slice(0, 80) } : c,
      );
      const next = { ...s, conversations };
      persist(next);
      return next;
    });
  },

  togglePin(conversationId: string) {
    conversationStore.setState((s) => {
      const conversations = s.conversations.map((c) =>
        c.id === conversationId ? { ...c, pinned: !c.pinned } : c,
      );
      const next = { ...s, conversations };
      persist(next);
      return next;
    });
  },

  remove(conversationId: string) {
    conversationStore.setState((s) => {
      const conversations = s.conversations.filter((c) => c.id !== conversationId);
      const activeId = s.activeId === conversationId ? (conversations[0]?.id ?? null) : s.activeId;
      const next = { conversations, activeId };
      persist(next);
      return next;
    });
  },

  /** Forgets the current person's history, in memory and in storage. */
  clearAll() {
    conversationStore.setState(() => EMPTY_STATE);
    storage.remove();
  },
};

/**
 * Replaces the store with the signed-in person's saved history (empty when signed out). Call it
 * from a client effect keyed on useStorageScope(), never in render, so SSR stays deterministic.
 */
export function hydrateConversations() {
  const parsed = storage.read() as Partial<PersistedConversations> | null;
  if (parsed?.version !== STORE_VERSION || !Array.isArray(parsed.conversations)) {
    conversationStore.setState(() => EMPTY_STATE);
    return;
  }
  const conversations = withinRetention(parsed.conversations as Conversation[]);
  conversationStore.setState(() => ({
    conversations,
    activeId: conversations.some((c) => c.id === parsed.activeId)
      ? (parsed.activeId ?? null)
      : null,
  }));
}

/** Case-insensitive search over titles and message content. */
export function searchConversations(list: Conversation[], query: string): Conversation[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      c.messages.some((m) => m.content.toLowerCase().includes(q)),
  );
}
