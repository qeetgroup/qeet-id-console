import type { TFunction } from "i18next";
import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Capability } from "@/platform/security/capability-model";

import { navGroups } from "./nav-groups";

export { navGroups };

export type NavSubItem = {
  title: string;
  url: string;
  requiredPermission?: Capability;
  planned?: boolean;
};

export type NavItem = {
  title: string;
  url: string;
  icon?: ReactNode;
  description?: string; // one-line summary on section overview cards
  requiredPermission?: Capability;
  items?: NavSubItem[];
};

// In `navGroups` (nav-groups.tsx), every label, title and description is a `nav` catalogue key;
// `useNavGroups()` returns them translated.
export type NavGroup = {
  id: string; // stable, for comparisons: the label is translated
  label: string;
  icon: ReactNode; // rail icon for the two-pane sidebar switcher
  items: NavItem[];
};

/** Returns `groups` with every label, title and description translated. */
export function translateNavigation(groups: NavGroup[], t: TFunction): NavGroup[] {
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
  const { t } = useTranslation();
  return useMemo(() => translateNavigation(navGroups, t), [t]);
}

export type NavTitleLookup = {
  group?: string;
  parent?: { title: string; url: string };
  title: string;
};

const ROUTE_REQUIREMENT_OVERRIDES: ReadonlyArray<{
  path: string;
  requiredPermission: Capability;
}> = [{ path: "/users/import", requiredPermission: "user.write" }];

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

function destinations(): Array<NavItem | NavSubItem> {
  return navGroups.flatMap((group) => group.items.flatMap((item) => [item, ...(item.items ?? [])]));
}

export function getRequiredCapabilityForPath(pathname: string): Capability | undefined {
  const normalized = normalizePathname(pathname);
  const override = ROUTE_REQUIREMENT_OVERRIDES.find((entry) => entry.path === normalized);
  if (override) return override.requiredPermission;

  return destinations()
    .filter((item) => pathMatchesBranch(normalized, item.url))
    .sort((a, b) => b.url.length - a.url.length)[0]?.requiredPermission;
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
  const segments = pathname.split("/").filter(Boolean);
  return { title: titleFromSlug(segments[segments.length - 1] ?? "Page") };
}
