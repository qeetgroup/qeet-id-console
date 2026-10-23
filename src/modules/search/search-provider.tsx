import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useStorageScope } from "@/platform/auth/scoped-storage";
import { useCapabilities } from "@/platform/security/capability-provider";

import type { RankContext } from "./ranking";
import { createCommandSource } from "./registry/command-source";
import { createNavigationSource } from "./registry/navigation-source";
import type { SearchContext, SearchItem } from "./registry/types/registry.types";
import type { FavoriteEntry } from "./store/favorites-store";
import { favoritesActions, favoritesStore, hydrateFavorites } from "./store/favorites-store";
import type { RecentEntry } from "./store/recent-store";
import { hydrateRecent, recentActions, recentStore } from "./store/recent-store";

export interface UniversalSearchContextValue {
  searchCtx: SearchContext;
  navigationItems: SearchItem[]; // Sidebar pages the person's capabilities allow
  commandItems: SearchItem[]; // Commands the person's capabilities allow
  recentEntries: RecentEntry[];
  favoriteEntries: FavoriteEntry[];
  addRecent(item: SearchItem): void;
  removeRecent(id: string): void;
  clearRecent(): void;
  toggleFavorite(item: SearchItem): void;
  isFavorite(id: string): boolean;
  /** Builds a fresh RankContext; call it inside useMemo to keep references stable. */
  getRankContext(): RankContext;
}

const UniversalSearchContext = createContext<UniversalSearchContextValue | null>(null);

// Built once; the items they return are capability-filtered per call via ctx.capabilities.
const navSource = createNavigationSource();
const cmdSource = createCommandSource();

/**
 * Provides universal search: capability-filtered pages and commands, the search context, and the
 * signed-in person's recents and favorites.
 */
export function SearchProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const access = useCapabilities();
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage;

  // Recents and favorites are scoped per person and tenant, so re-read them on the client
  // (never during render) whenever that scope changes.
  const storageScope = useStorageScope();
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read on scope change
  useEffect(() => {
    hydrateRecent();
    hydrateFavorites();
  }, [storageScope]);

  const recentEntries = useStore(recentStore, (s) => s.entries);
  const favoriteEntries = useStore(favoritesStore, (s) => s.entries);

  // A language change rebuilds the items in it.
  const searchCtx = useMemo<SearchContext>(
    () => ({
      pathname,
      tenantId: access.tenantId,
      capabilities: access.permissions,
      navigate: (url: string) => navigate({ to: url }),
      language,
    }),
    // useNavigate returns a stable callback, so listing it never recomputes the context.
    [pathname, access.tenantId, access.permissions, navigate, language],
  );

  // Until capabilities load there is nothing to filter against, so no items are offered.
  const navigationItems = useMemo(
    () => (access.state === "ready" ? navSource.getItems("", searchCtx) : []),
    [access.state, searchCtx],
  );
  const commandItems = useMemo(
    () => (access.state === "ready" ? cmdSource.getItems("", searchCtx) : []),
    [access.state, searchCtx],
  );

  const getRankContext = useCallback(
    (): RankContext => ({
      recentIds: new Set(recentEntries.map((e) => e.id)),
      recentAccessCounts: new Map(recentEntries.map((e) => [e.id, e.accessCount])),
      favoriteIds: new Set(favoriteEntries.map((e) => e.id)),
      currentPathname: pathname,
    }),
    [recentEntries, favoriteEntries, pathname],
  );

  const addRecent = useCallback((item: SearchItem) => recentActions.add(item), []);
  const removeRecent = useCallback((id: string) => recentActions.remove(id), []);
  const clearRecent = useCallback(() => recentActions.clear(), []);
  const toggleFavorite = useCallback((item: SearchItem) => favoritesActions.toggle(item), []);
  const isFavorite = useCallback((id: string) => favoritesActions.isFavorite(id), []);

  const value = useMemo<UniversalSearchContextValue>(
    () => ({
      searchCtx,
      navigationItems,
      commandItems,
      recentEntries,
      favoriteEntries,
      addRecent,
      removeRecent,
      clearRecent,
      toggleFavorite,
      isFavorite,
      getRankContext,
    }),
    [
      searchCtx,
      navigationItems,
      commandItems,
      recentEntries,
      favoriteEntries,
      addRecent,
      removeRecent,
      clearRecent,
      toggleFavorite,
      isFavorite,
      getRankContext,
    ],
  );

  return (
    <UniversalSearchContext.Provider value={value}>{children}</UniversalSearchContext.Provider>
  );
}

export function useUniversalSearch(): UniversalSearchContextValue {
  const value = useContext(UniversalSearchContext);
  if (!value) throw new Error("useUniversalSearch must be used inside SearchProvider");
  return value;
}
