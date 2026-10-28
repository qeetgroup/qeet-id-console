// Whether the Qeet AI panel shows, which view, and how wide. It starts closed so the server and
// first client render match; hydrateWorkspace re-applies the saved width after mount, and `open`
// is never saved. The width is a device preference, so it stays unscoped.

import { Store } from "@tanstack/react-store";

import type { WorkspacePrefs } from "../types/qeetai.types";

export const MIN_DOCK_WIDTH = 340;
export const MAX_DOCK_WIDTH = 720;
export const DEFAULT_DOCK_WIDTH = 400;

const PREFS_KEY = "qeetid.qeetai.prefs";

export interface WorkspaceState extends WorkspacePrefs {
  open: boolean;
  historyOpen: boolean; // Session-only: whether the conversation history view is showing
}

const DEFAULT_STATE: WorkspaceState = {
  open: false,
  historyOpen: false,
  dockWidth: DEFAULT_DOCK_WIDTH,
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
  toggle() {
    workspaceStore.setState((s) => ({ ...s, open: !s.open, historyOpen: false }));
  },
  toggleHistory() {
    workspaceStore.setState((s) => ({ ...s, historyOpen: !s.historyOpen }));
  },
  closeHistory() {
    workspaceStore.setState((s) => (s.historyOpen ? { ...s, historyOpen: false } : s));
  },
  setDockWidth(width: number) {
    workspaceStore.setState((s) => ({ ...s, dockWidth: clampDockWidth(width) }));
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
    const prefs: WorkspacePrefs = { dockWidth: state.dockWidth };
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // storage may be unavailable (private mode); preferences are best-effort
  }
}

/**
 * Applies the saved width and saves later changes; returns the unsubscribe. Call once from a
 * client mount effect. Safe when storage is unavailable. Earlier versions also saved a mode and
 * a collapsed rail, which are ignored now.
 */
export function hydrateWorkspace(): () => void {
  const prefs = readPrefs();
  if (prefs && typeof prefs.dockWidth === "number") {
    const dockWidth = clampDockWidth(prefs.dockWidth);
    workspaceStore.setState((s) => ({ ...s, dockWidth }));
  }
  const subscription = workspaceStore.subscribe(() => writePrefs(workspaceStore.state));
  return () => subscription.unsubscribe();
}
