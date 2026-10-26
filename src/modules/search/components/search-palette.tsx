import type { QeetrixIcon } from "@qeetrix/react";
import { type CommandGroup, type CommandItem, CommandPalette } from "@qeetrix/react/experimental";
import { isValidElement, type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { shortcutContributions } from "@/platform/modules/registry";
import { useResourceSearch } from "../api/search";
import { rankItems } from "../ranking";
import { resourceHitsToSearchItems } from "../registry/resource-source";
import type { SearchItem } from "../registry/types/registry.types";
import { useUniversalSearch } from "../search-provider";

const DEBOUNCE_MS = 200;
const MAX_RECENT = 6;
const MAX_PAGES = 8;
const MAX_ACTIONS = 6;
const FIRST_ACTIONS = 5;

// Sources give icons as elements (<UsersIcon />); the palette takes the component.
function iconOf(node: ReactNode): QeetrixIcon | undefined {
  return isValidElement(node) && typeof node.type !== "string"
    ? (node.type as QeetrixIcon)
    : undefined;
}

/**
 * Search or jump to (⌘K), on the shared Qeet CommandPalette: with no query, recent items and the
 * main actions; typing, pages (where each lives, and its G-key shortcut), actions, then the
 * organisation's records from GET /v1/search, grouped by type. Choosing one opens or runs it and
 * adds it to Recent.
 */
export function SearchPalette({
  open,
  onOpenChange,
  hotkey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ⌘K / Ctrl+K opens it; off until the person's access has loaded. */
  hotkey: boolean;
}) {
  const { t } = useTranslation("search");
  const { searchCtx, navigationItems, commandItems, recentEntries, addRecent, getRankContext } =
    useUniversalSearch();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebounced("");
    }
  }, [open]);
  const resources = useResourceSearch(debounced, open);

  const shortcutFor = useMemo(
    () => new Map(shortcutContributions().map((s) => [s.to, ["G", s.key.toUpperCase()]] as const)),
    [],
  );

  const { groups, byValue } = useMemo(() => {
    const byValue = new Map<string, SearchItem>();
    const toCommand = (item: SearchItem): CommandItem => {
      byValue.set(item.id, item);
      const where =
        item.kind === "navigation"
          ? item.subtitle
            ? `${item.category} › ${item.subtitle}`
            : item.category
          : item.status;
      return {
        value: item.id,
        label: item.title,
        description: item.kind === "navigation" ? undefined : item.subtitle,
        meta: where,
        icon: iconOf(item.icon),
        keywords: item.keywords,
        shortcut: item.url ? shortcutFor.get(item.url) : undefined,
      };
    };
    const known = new Map([...navigationItems, ...commandItems].map((item) => [item.id, item]));
    const q = query.trim();
    const groups: CommandGroup[] = [];

    if (q === "") {
      const recent = recentEntries.slice(0, MAX_RECENT).map(
        (entry): SearchItem =>
          // A page or action that still exists opens as itself (icon, run); a record by its URL.
          known.get(entry.id) ?? { ...entry, keywords: [] },
      );
      if (recent.length > 0)
        groups.push({ label: t("category.recent"), items: recent.map(toCommand) });
      if (commandItems.length > 0)
        groups.push({
          label: t("category.commands"),
          items: commandItems.slice(0, FIRST_ACTIONS).map(toCommand),
        });
      return { groups, byValue };
    }

    const rank = getRankContext();
    const pages = rankItems(navigationItems, q, rank).slice(0, MAX_PAGES);
    if (pages.length > 0)
      groups.push({ label: t("category.navigation"), items: pages.map((r) => toCommand(r.item)) });
    const actions = rankItems(commandItems, q, rank).slice(0, MAX_ACTIONS);
    if (actions.length > 0)
      groups.push({ label: t("category.commands"), items: actions.map((r) => toCommand(r.item)) });
    const records = new Map<string, CommandItem[]>();
    for (const item of resourceHitsToSearchItems(resources.data?.results ?? [])) {
      records.set(item.category, [...(records.get(item.category) ?? []), toCommand(item)]);
    }
    for (const [label, items] of records) groups.push({ label, items });
    return { groups, byValue };
  }, [
    t,
    query,
    navigationItems,
    commandItems,
    recentEntries,
    resources.data,
    getRankContext,
    shortcutFor,
  ]);

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      hotkey={hotkey}
      groups={groups}
      onQueryChange={setQuery}
      loading={resources.isFetching && debounced.length >= 2}
      placeholder={t("universalSearch.placeholder")}
      onSelect={(chosen) => {
        const item = byValue.get(chosen.value);
        if (!item) return;
        if (item.run) item.run(searchCtx);
        else if (item.url) searchCtx.navigate(item.url);
        addRecent(item);
      }}
    />
  );
}
