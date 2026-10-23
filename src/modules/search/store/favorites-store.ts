// Search items the person has pinned. They can carry tenant resource titles, so they are saved
// per person and tenant and wiped on sign-out.

import { Store } from "@tanstack/react-store";

import { scopedStorage } from "@/platform/auth/scoped-storage";

import type { SearchItem, SearchItemKind } from "../registry/types/registry.types";

export interface FavoriteEntry {
  id: string;
  kind: SearchItemKind;
  category: string;
  title: string;
  subtitle?: string;
  url?: string;
  pinnedAt: number; // Unix ms when pinned
}

export interface FavoritesState {
  entries: FavoriteEntry[];
}

export const favoritesStore = new Store<FavoritesState>({ entries: [] });

const storage = scopedStorage("qeetid.search.favorites", {
  onScopeChange: () => favoritesStore.setState(() => ({ entries: [] })),
});

function persist(state: FavoritesState): void {
  storage.write(state);
}

export const favoritesActions = {
  /** Pins the item, or unpins it if already pinned. */
  toggle(item: SearchItem): void {
    favoritesStore.setState((s) => {
      const exists = s.entries.some((e) => e.id === item.id);
      let entries: FavoriteEntry[];
      if (exists) {
        entries = s.entries.filter((e) => e.id !== item.id);
      } else {
        const entry: FavoriteEntry = {
          id: item.id,
          kind: item.kind,
          category: item.category,
          title: item.title,
          subtitle: item.subtitle,
          url: item.url,
          pinnedAt: Date.now(),
        };
        entries = [entry, ...s.entries];
      }
      const next: FavoritesState = { entries };
      persist(next);
      return next;
    });
  },

  /** Reads the store directly, so it works outside React. */
  isFavorite(id: string): boolean {
    return favoritesStore.state.entries.some((e) => e.id === id);
  },

  clear(): void {
    const next: FavoritesState = { entries: [] };
    favoritesStore.setState(() => next);
    persist(next);
  },
};

/** Loads the signed-in person's favorites (none when signed out), like hydrateRecent. */
export function hydrateFavorites(): void {
  const parsed = storage.read() as Partial<FavoritesState> | null;
  const entries = Array.isArray(parsed?.entries) ? (parsed.entries as FavoriteEntry[]) : [];
  favoritesStore.setState(() => ({ entries }));
}
