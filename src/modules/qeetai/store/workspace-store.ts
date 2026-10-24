// How the workspace panel is presented. It starts closed so the server and first client render
// match; hydrateWorkspace re-applies saved preferences after mount, and `open` is never saved.

import { Store } from "@tanstack/react-store";

import type { QeetAIMode, WorkspacePrefs } from "../types/qeetai.types";

export const MIN_DOCK_WIDTH = 340;
export const MAX_DOCK_WIDTH = 720;
export const DEFAULT_DOCK_WIDTH = 420;

const PREFS_KEY = "qeetid.qeetai.prefs";

export interface WorkspaceState extends WorkspacePrefs {
  open: boolean;
  historyOpen: boolean; // Session-only: whether the conversation history view is showing
}

const DEFAULT_STATE: WorkspaceState = {
  open: false,
  historyOpen: false,
  mode: "docked",
  dockWidth: DEFAULT_DOCK_WIDTH,
  collapsed: false,
};

export const workspaceStore = new Store<WorkspaceState>(DEFAULT_STATE);

export function clampDockWidth(width: number): number {
  if (Number.isNaN(width)) return DEFAULT_DOCK_WIDTH;
  return Math.min(MAX_DOCK_WIDTH, Math.max(MIN_DOCK_WIDTH, Math.round(width)));
}

export const workspaceActions = {
  open() {
    workspaceStore.setState((s) => (s.open ? s : { ...s, open: true }));
  },
  close() {
    workspaceStore.setState((s) => (s.open ? { ...s, open: false, historyOpen: false } : s));
  },
  toggleHistory() {
    workspaceStore.setState((s) => ({ ...s, historyOpen: !s.historyOpen }));
  },
  closeHistory() {
    workspaceStore.setState((s) => (s.historyOpen ? { ...s, historyOpen: false } : s));
  },
  toggle() {
    workspaceStore.setState((s) => ({ ...s, open: !s.open }));
  },
  setMode(mode: QeetAIMode) {
    // Choosing a mode shows the panel; the collapsed rail exists only while docked.
    workspaceStore.setState((s) => ({
      ...s,
      mode,
      open: true,
      collapsed: mode === "docked" ? s.collapsed : false,
    }));
  },
  setDockWidth(width: number) {
    workspaceStore.setState((s) => ({ ...s, dockWidth: clampDockWidth(width) }));
  },
  toggleCollapsed() {
    workspaceStore.setState((s) => ({ ...s, collapsed: !s.collapsed }));
  },
  setCollapsed(collapsed: boolean) {
    workspaceStore.setState((s) => ({ ...s, collapsed }));
  },
};

function readPrefs(): Partial<WorkspacePrefs> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorkspacePrefs>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writePrefs(state: WorkspaceState) {
  if (typeof window === "undefined") return;
  try {
    const prefs: WorkspacePrefs = {
      mode: state.mode,
      dockWidth: state.dockWidth,
      collapsed: state.collapsed,
    };
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // storage may be unavailable (private mode); preferences are best-effort
  }
}

/**
 * Applies saved preferences and saves later changes; returns the unsubscribe. Call once from a
 * client mount effect. Safe when storage is unavailable.
 */
export function hydrateWorkspace(): () => void {
  const prefs = readPrefs();
  if (prefs) {
    workspaceStore.setState((s) => ({
      ...s,
      mode: prefs.mode === "floating" || prefs.mode === "fullscreen" ? prefs.mode : "docked",
      dockWidth: clampDockWidth(prefs.dockWidth ?? s.dockWidth),
      collapsed: Boolean(prefs.collapsed),
    }));
  }
  const subscription = workspaceStore.subscribe(() => writePrefs(workspaceStore.state));
  return () => subscription.unsubscribe();
}
