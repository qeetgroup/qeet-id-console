import type { ToolExecution } from "../tools/types/tool.types";

/** How the workspace panel is presented. */
export type QeetAIMode = "docked" | "floating" | "fullscreen";

/** Who authored a message in a conversation. */
export type MessageRole = "user" | "assistant" | "system";

/**
 * An assistant message's lifecycle: `streaming` while it is produced, then `complete`, `error`
 * or `cancelled`. User messages are always `complete`.
 */
export type MessageStatus = "streaming" | "complete" | "error" | "cancelled";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  status: MessageStatus;
  error?: string; // What went wrong, when `status` is `error`
  contextPath?: string; // The route the operator was on when the message was added
  /** Tools run on this turn, client-side under the operator's own permissions. */
  toolExecutions?: ToolExecution[];
}

export interface Conversation {
  id: string;
  title: string; // Empty until the first user message names it; the UI shows a placeholder
  messages: Message[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  /**
   * The server conversation's id, set when the first turn streams from the backend. The local
   * `id` stays the UI's key.
   */
  serverId?: string;
}

/** Persisted UI preferences for the panel (mode, width, collapsed rail). */
export interface WorkspacePrefs {
  mode: QeetAIMode;
  dockWidth: number; // Docked-panel width in px. Clamped to [MIN_DOCK_WIDTH, MAX_DOCK_WIDTH]
  collapsed: boolean; // Collapsed to a slim rail (docked mode only)
}
