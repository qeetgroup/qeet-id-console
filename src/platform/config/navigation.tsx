import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";

import i18n, { type TranslationKey } from "@/i18n";
import { navContributions, registeredModules } from "@/platform/modules/registry";
import type { NavContribution } from "@/platform/modules/manifest";
import type { Capability } from "@/platform/security/capability-model";

import { NAV_GROUP_DEFINITIONS } from "./nav-groups";

// `Text` is the copy's form: catalogue keys from `getNavGroups()`, translated strings from
// `useNavGroups()` and `translateNavigation()`.
export type NavSubItem<Text extends string = string> = {
  title: Text;
  url: string;
  requiredPermission?: Capability;
  planned?: boolean;
};

export type NavItem<Text extends string = string> = {
  title: Text;
  url: string;
  icon?: ReactNode;
  description?: Text; // one-line summary on section overview cards
  requiredPermission?: Capability;
  items?: NavSubItem<Text>[];
};

export type NavGroup<Text extends string = string> = {
  id: string; // stable, for comparisons: the label is translated
  label: Text;
  icon: ReactNode; // rail icon for the two-pane sidebar switcher
  items: NavItem<Text>[];
};

const byOrder = (a: NavContribution, b: NavContribution) => a.order - b.order;

let built: { from: unknown; groups: NavGroup<TranslationKey>[] } | null = null;

/**
 * Returns the sidebar: each group's entries from the registered modules' manifests, in order,
 * with entries nested under their `parent`. Throws on an entry naming an unknown group or parent.
 */
export function getNavGroups(): NavGroup<TranslationKey>[] {
  const modules = registeredModules();
  if (built?.from === modules) return built.groups;
  const entries = navContributions();
  const ids = new Set(entries.map((e) => e.id));
  for (const e of entries) {
    if (!NAV_GROUP_DEFINITIONS.some((g) => g.id === e.group)) {
      throw new Error(`Nav entry "${e.id}" names unknown group "${e.group}"`);
    }
    if (e.parent && !ids.has(e.parent)) {
      throw new Error(`Nav entry "${e.id}" names unknown parent "${e.parent}"`);
    }
  }
  const groups = NAV_GROUP_DEFINITIONS.map((group) => ({
    ...group,
    items: entries
      .filter((e) => e.group === group.id && !e.parent)
      .sort(byOrder)
      .map(
        (e): NavItem<TranslationKey> => ({
          title: e.title,
          url: e.url,
          icon: e.icon,
          description: e.description,
          requiredPermission: e.capability,
          items: entries
            .filter((child) => child.parent === e.id)
            .sort(byOrder)
            .map((child) => ({
              title: child.title,
              url: child.url,
              requiredPermission: child.capability,
              planned: child.planned,
            })),
        }),
      )
      .map((item) => (item.items?.length ? item : { ...item, items: undefined })),
  }));
  built = { from: modules, groups };
  return groups;
}

/** Returns `groups` with every label, title and description in the current language. */
export function translateNavigation(groups: NavGroup<TranslationKey>[]): NavGroup[] {
  const t = (key: TranslationKey): string => i18n.t(key);
  return groups.map((group) => ({
    ...group,
    label: t(group.label),
    items: group.items.map((item) => ({
      ...item,
      title: t(item.title),
      description: item.description && t(item.description),
      items: item.items?.map((sub) => ({ ...sub, title: t(sub.title) })),
    })),
  }));
}

/** Returns the navigation in the current language, re-rendering when it changes. */
export function useNavGroups(): NavGroup[] {
  const { i18n: instance } = useTranslation();
  const language = instance.resolvedLanguage;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the copy changes with the language
  return useMemo(() => translateNavigation(getNavGroups()), [language]);
}

export type NavTitleLookup = {
  group?: string;
  parent?: { title: string; url: string };
  title: string;
};

const SAFE_DESTINATIONS = new Set(["/", "/organizations"]);

function normalizePathname(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  if (path === "/") return path;
  return path.replace(/\/+$/, "") || "/";
}

function pathMatchesBranch(pathname: string, destination: string): boolean {
  return (
    pathname === destination || (destination !== "/" && pathname.startsWith(`${destination}/`))
  );
}

/**
 * Returns the id of the group the two-pane rail highlights for a route, by the longest matching
 * destination (so `/authorization/roles/42` selects authorization), or undefined if unmapped.
 */
export function findNavGroupForPath(groups: NavGroup[], pathname: string): string | undefined {
  const normalized = normalizePathname(pathname);
  let bestId: string | undefined;
  let bestLength = -1;
  for (const group of groups) {
    for (const item of group.items) {
      for (const dest of [item, ...(item.items ?? [])]) {
        if (pathMatchesBranch(normalized, dest.url) && dest.url.length > bestLength) {
          bestId = group.id;
          bestLength = dest.url.length;
        }
      }
    }
  }
  return bestId;
}

export function filterNavigation(
  groups: NavGroup[],
  can: (permission?: Capability) => boolean,
): NavGroup[] {
  return groups.flatMap((group) => {
    const items = group.items.flatMap((item) => {
      const visibleChildren = item.items?.filter((child) => can(child.requiredPermission));
      const ownRouteVisible = can(item.requiredPermission);
      if (!ownRouteVisible && (!visibleChildren || visibleChildren.length === 0)) return [];
      return [{ ...item, items: visibleChildren }];
    });
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

export function safeNavigation(groups: NavGroup[]): NavGroup[] {
  return groups.flatMap((group) => {
    const items = group.items.flatMap((item) => {
      const visibleChildren = item.items?.filter((child) => SAFE_DESTINATIONS.has(child.url));
      const ownRouteVisible = SAFE_DESTINATIONS.has(item.url);
      if (!ownRouteVisible && (!visibleChildren || visibleChildren.length === 0)) return [];
      return [{ ...item, items: visibleChildren }];
    });
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/** Finds a path's titles in `groups`, as `useNavGroups()` returns them. */
export function lookupNavTitle(pathname: string, groups: NavGroup[]): NavTitleLookup {
  for (const group of groups) {
    for (const item of group.items) {
      if (item.url === pathname) {
        return { group: group.label, title: item.title };
      }
      const sub = item.items?.find((s) => s.url === pathname);
      if (sub) {
        return {
          group: group.label,
          parent: { title: item.title, url: item.url },
          title: sub.title,
        };
      }
    }
  }
  // A page without its own entry, such as a user's detail page, sits under the deepest section
  // whose address leads to it; an id in its address reads as "Details", never as the raw id.
  const section = deepestSection(pathname, groups);
  const slug = pathname.split("/").filter(Boolean).at(-1);
  const title = !slug
    ? i18n.t("common:pageTitle.untitled")
    : looksLikeId(slug)
      ? i18n.t("common:pageTitle.details")
      : titleFromSlug(slug);
  return section ? { group: section.group, parent: section.parent, title } : { title };
}

// UUIDs and other opaque ids: long, or digits mixed into hex-like text.
function looksLikeId(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment) || (segment.length >= 16 && /\d/.test(segment));
}

function deepestSection(
  pathname: string,
  groups: NavGroup[],
): { group: string; parent: { title: string; url: string } } | undefined {
  let best: { group: string; parent: { title: string; url: string } } | undefined;
  for (const group of groups) {
    for (const entry of group.items.flatMap((item) => [item, ...(item.items ?? [])])) {
      if (entry.url === "/" || !pathname.startsWith(`${entry.url}/`)) continue;
      if (!best || entry.url.length > best.parent.url.length) {
        best = { group: group.label, parent: { title: entry.title, url: entry.url } };
      }
    }
  }
  return best;
}
