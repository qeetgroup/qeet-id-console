// The items last opened from universal search. Entries carry tenant resource titles, so they are
// saved per person and tenant and wiped on sign-out.

import { Store } from "@tanstack/react-store";

import { scopedStorage } from "@/platform/auth/scoped-storage";

import type { SearchItem, SearchItemKind } from "../registry/types/registry.types";

const MAX_ENTRIES = 50;

export interface RecentEntry {
  id: string; // Matches the SearchItem.id that was opened
  kind: SearchItemKind;
  category: string;
  title: string;
  subtitle?: string;
  url?: string;
  timestamp: number; // Unix ms of the last open, which orders the list
  accessCount: number; // Times opened, for the ranking's frequency boost
}

export interface RecentState {
  entries: RecentEntry[];
}

export const recentStore = new Store<RecentState>({ entries: [] });

const storage = scopedStorage("qeetid.search.recent", {
  onScopeChange: () => recentStore.setState(() => ({ entries: [] })),
});

function persist(state: RecentState): void {
  storage.write(state);
}

export const recentActions = {
  /** Records an open: the item moves to the front and its count rises. Keeps MAX_ENTRIES. */
  add(item: SearchItem): void {
    recentStore.setState((s) => {
      const now = Date.now();
      const existing = s.entries.find((e) => e.id === item.id);
      let entries: RecentEntry[];
      if (existing) {
        entries = s.entries.map((e) =>
          e.id === item.id ? { ...e, timestamp: now, accessCount: e.accessCount + 1 } : e,
        );
      } else {
        const entry: RecentEntry = {
          id: item.id,
          kind: item.kind,
          category: item.category,
          title: item.title,
          subtitle: item.subtitle,
          url: item.url,
          timestamp: now,
          accessCount: 1,
        };
        entries = [entry, ...s.entries].slice(0, MAX_ENTRIES);
      }
      const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
      const next: RecentState = { entries: sorted };
      persist(next);
      return next;
    });
  },

  remove(id: string): void {
    recentStore.setState((s) => {
      const entries = s.entries.filter((e) => e.id !== id);
      const next: RecentState = { entries };
      persist(next);
      return next;
    });
  },

  clear(): void {
    const next: RecentState = { entries: [] };
    recentStore.setState(() => next);
    persist(next);
  },
};

/**
 * Loads the signed-in person's entries (none when signed out). Call from an effect keyed on
 * useStorageScope(), never during render, so SSR output stays deterministic.
 */
export function hydrateRecent(): void {
  const parsed = storage.read() as Partial<RecentState> | null;
  const entries = Array.isArray(parsed?.entries) ? (parsed.entries as RecentEntry[]) : [];
  recentStore.setState(() => ({ entries }));
}
