import { cn, EmptyState, Kbd, ScrollArea, Separator, Skeleton, Spinner } from "@qeetrix/ui";
import { RotateCcwClockIcon, SearchIcon, XIcon } from "@qeetrix/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { moveHighlight } from "../keyboard";
import { rankItems } from "../ranking";
import { resourceHitsToSearchItems } from "../registry/resource-source";
import type { SearchItem, SearchResultGroup } from "../registry/types/registry.types";
import { useUniversalSearch } from "../search-provider";
import { PreviewPane } from "./preview-pane";
import { ResultGroups } from "./result-groups";
import { useResourceSearch } from "../api/search";

const LISTBOX_ID = "us-listbox";
const MAX_NAV_RESULTS = 20;
const MAX_CMD_RESULTS = 10;
const MAX_RECENT_SHOWN = 8;
const DEBOUNCE_MS = 200;

interface UniversalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Renders the universal search palette in a native <dialog>: ranked pages, commands and
 * GET /v1/search resources, or favorites and recents with no query, plus a preview of the
 * highlighted item. Choosing an item runs or opens it and records it as recent.
 */
export function UniversalSearch({ open, onOpenChange }: UniversalSearchProps) {
  const { t } = useTranslation(["search", "common"]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const {
    searchCtx,
    navigationItems,
    commandItems,
    recentEntries,
    favoriteEntries,
    addRecent,
    clearRecent,
    toggleFavorite,
    isFavorite,
    getRankContext,
  } = useUniversalSearch();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setDebouncedQuery("");
      setHighlightIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  const resourceQuery = useResourceSearch(debouncedQuery, open);

  const rankCtx = useMemo(() => getRankContext(), [getRankContext]);

  const { groups, allItems } = useMemo<{
    groups: SearchResultGroup[];
    allItems: SearchItem[];
  }>(() => {
    const grouped: SearchResultGroup[] = [];
    const all: SearchItem[] = [];

    if (!query) {
      if (favoriteEntries.length > 0) {
        const items: SearchItem[] = favoriteEntries.map(
          (e): SearchItem => ({
            id: e.id,
            kind: "favorite",
            category: t("category.favorites"),
            title: e.title,
            subtitle: e.subtitle,
            url: e.url,
          }),
        );
        grouped.push({ category: t("category.favorites"), items });
        all.push(...items);
      }

      const recentSlice = recentEntries.slice(0, MAX_RECENT_SHOWN);
      if (recentSlice.length > 0) {
        const items: SearchItem[] = recentSlice.map(
          (e): SearchItem => ({
            id: e.id,
            kind: "recent",
            category: t("category.recent"),
            title: e.title,
            subtitle: e.subtitle,
            url: e.url,
          }),
        );
        grouped.push({ category: t("category.recent"), items });
        all.push(...items);
      }

      return { groups: grouped, allItems: all };
    }

    const navRanked = rankItems(navigationItems, query, rankCtx).slice(0, MAX_NAV_RESULTS);
    if (navRanked.length > 0) {
      const items = navRanked.map((r) => r.item);
      grouped.push({ category: t("category.navigation"), items });
      all.push(...items);
    }

    const cmdRanked = rankItems(commandItems, query, rankCtx).slice(0, MAX_CMD_RESULTS);
    if (cmdRanked.length > 0) {
      const items = cmdRanked.map((r) => r.item);
      grouped.push({ category: t("category.commands"), items });
      all.push(...items);
    }

    const hits = resourceQuery.data?.results ?? [];
    const resourceItems = resourceHitsToSearchItems(hits);
    const byCategory = new Map<string, SearchItem[]>();
    for (const ri of resourceItems) {
      const bucket = byCategory.get(ri.category) ?? [];
      bucket.push(ri);
      byCategory.set(ri.category, bucket);
    }
    for (const [cat, items] of byCategory) {
      grouped.push({ category: cat, items });
      all.push(...items);
    }

    return { groups: grouped, allItems: all };
  }, [
    t,
    query,
    navigationItems,
    commandItems,
    rankCtx,
    resourceQuery.data,
    recentEntries,
    favoriteEntries,
  ]);

  const clampedHighlight = Math.min(highlightIndex, Math.max(0, allItems.length - 1));
  const selectedItem: SearchItem | null = allItems[clampedHighlight] ?? null;

  function commit(item: SearchItem): void {
    if (item.run) {
      item.run(searchCtx);
    } else if (item.url) {
      searchCtx.navigate(item.url);
    }
    addRecent(item);
    onOpenChange(false);
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((h) => moveHighlight(h, "down", allItems.length));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((h) => moveHighlight(h, "up", allItems.length));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedItem) commit(selectedItem);
        break;
      // Esc: the native <dialog> fires onClose automatically.
    }
  }

  const isLoadingResources = resourceQuery.isFetching && debouncedQuery.length >= 2;
  const hasResults = allItems.length > 0;
  const showEmpty = query.length >= 2 && !isLoadingResources && !hasResults;
  const showPreview = selectedItem !== null && query.length > 0;

  const getItemId = (idx: number) => `us-item-${idx}`;
  const highlightedItemId = hasResults ? getItemId(clampedHighlight) : undefined;

  return (
    <dialog
      ref={dialogRef}
      onKeyDown={handleKeyDown}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        // A click whose target is the dialog itself landed on the backdrop.
        if (e.target === dialogRef.current) onOpenChange(false);
      }}
      aria-label={t("universalSearch.universalSearch")}
      className={cn(
        "fixed left-1/2 top-[8vh] -translate-x-1/2",
        // Wide enough for the preview pane while fitting a 1024px viewport.
        "w-[min(52rem,calc(100%-2rem))]",
        "rounded-xl border bg-popover p-0 text-popover-foreground shadow-modal",
        "backdrop:bg-foreground/30 backdrop:backdrop-blur-sm",
        "open:animate-in open:fade-in-0 open:zoom-in-95",
      )}
    >
      <div className="flex flex-col" style={{ maxHeight: "80vh" }}>
        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-3">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-controls={LISTBOX_ID}
            aria-expanded={hasResults}
            aria-autocomplete="list"
            aria-activedescendant={highlightedItemId}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightIndex(0);
            }}
            placeholder={t("universalSearch.searchTheControlPlane")}
            aria-label={t("common:actions.search")}
            className="h-12 w-full border-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {isLoadingResources && (
            <Spinner
              size="sm"
              label={t("universalSearch.searchingResources")}
              className="shrink-0"
            />
          )}
          {query.length > 0 && (
            <button
              type="button"
              aria-label={t("universalSearch.clearSearch")}
              className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                setQuery("");
                setDebouncedQuery("");
                setHighlightIndex(0);
                inputRef.current?.focus();
              }}
            >
              <XIcon className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Content area */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Results list */}
          <ScrollArea className="min-w-0 flex-1">
            <div
              id={LISTBOX_ID}
              role="listbox"
              aria-label={t("universalSearch.searchResults")}
              aria-multiselectable="false"
              className="p-1"
            >
              {showEmpty ? (
                <EmptyState
                  title={t("universalSearch.noResults")}
                  description={t("universalSearch.nothingMatched", { query })}
                  className="py-8"
                />
              ) : isLoadingResources && !hasResults ? (
                <SearchSkeleton />
              ) : (
                <ResultGroups
                  groups={groups}
                  query={query}
                  highlightIndex={clampedHighlight}
                  allItems={allItems}
                  onHighlight={setHighlightIndex}
                  onSelect={commit}
                  getItemId={getItemId}
                />
              )}

              {/* Recents management link */}
              {!query && recentEntries.length > 0 && (
                <div className="border-t px-2 py-2">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => clearRecent()}
                  >
                    <RotateCcwClockIcon className="size-3" aria-hidden="true" />
                    {t("universalSearch.clearRecentHistory")}
                  </button>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Preview pane, hidden on small viewports so the results keep their width */}
          {showPreview && selectedItem !== null && (
            <>
              <Separator orientation="vertical" className="hidden sm:block" />
              <div className="hidden sm:block sm:w-52 sm:shrink-0 sm:overflow-y-auto">
                <PreviewPane
                  item={selectedItem}
                  ctx={searchCtx}
                  isFavorite={isFavorite(selectedItem.id)}
                  onToggleFavorite={() => toggleFavorite(selectedItem)}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-3">
            <span>
              <Kbd>↑↓</Kbd> <span>{t("universalSearch.hint.navigate")}</span>
            </span>
            <span>
              <Kbd>↵</Kbd> <span>{t("universalSearch.hint.select")}</span>
            </span>
            <span>
              <Kbd>esc</Kbd> <span>{t("universalSearch.hint.close")}</span>
            </span>
          </span>
          {hasResults && (
            <span>{t("universalSearch.resultCount", { count: allItems.length })}</span>
          )}
        </div>
      </div>
    </dialog>
  );
}

function SearchSkeleton() {
  const { t } = useTranslation("search");
  return (
    <div
      role="status"
      className="flex flex-col gap-1 p-1"
      aria-label={t("universalSearch.loadingResults")}
      aria-busy="true"
    >
      <SkRow />
      <SkRow />
      <SkRow wide />
      <SkRow />
      <SkRow wide />
    </div>
  );
}

function SkRow({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2">
      <Skeleton className="size-5 shrink-0 rounded-md" />
      <div className="flex flex-1 flex-col gap-1">
        <Skeleton className={cn("h-3.5 rounded", wide ? "w-40" : "w-28")} />
        <Skeleton className={cn("h-2.5 rounded", wide ? "w-56" : "w-44")} />
      </div>
    </div>
  );
}
