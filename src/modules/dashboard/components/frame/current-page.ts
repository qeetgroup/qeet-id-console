import type { NavGroup, NavItem } from "@/platform/config/navigation";

// "/users" holds "/users" and "/users/42"; "/" holds only itself, or it would hold every page.
function holds(url: string, pathname: string): boolean {
  if (url === "/") return pathname === "/";
  return pathname === url || pathname.startsWith(`${url}/`);
}

/** The page (a top-level nav item) the path is in: the longest of its URL or a sub-page's. */
export function currentNavItem(
  groups: readonly NavGroup[],
  pathname: string,
): { group: NavGroup; item: NavItem } | undefined {
  let best: { group: NavGroup; item: NavItem; length: number } | undefined;
  for (const group of groups) {
    for (const item of group.items) {
      for (const url of [item.url, ...(item.items ?? []).map((sub) => sub.url)]) {
        if (holds(url, pathname) && url.length > (best?.length ?? -1)) {
          best = { group, item, length: url.length };
        }
      }
    }
  }
  return best && { group: best.group, item: best.item };
}

/** The URL of the page the path is in, for the sidebar's current mark. */
export function currentNavItemUrl(groups: readonly NavGroup[], pathname: string) {
  return currentNavItem(groups, pathname)?.item.url;
}

/** The sub-page the path is on, within its page: the longest matching sub-page URL. */
export function currentSubPageUrl(item: NavItem, pathname: string): string | undefined {
  return (item.items ?? [])
    .filter((sub) => holds(sub.url, pathname))
    .sort((a, b) => b.url.length - a.url.length)[0]?.url;
}
