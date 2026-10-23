import type { NavGroup } from "@/platform/config/navigation";
import { navGroups, translateNavigation } from "@/platform/config/navigation";
import type { Capability } from "@/platform/security/capability-model";

import type { SearchContext, SearchItem, SearchSource } from "./types/registry.types";

/**
 * Flattens the sidebar nav into the navigation items `can` allows, skipping planned pages. A
 * parent whose url is also a child's is left out, since the child covers it; sub-items take the
 * parent title as their subtitle.
 */
export function buildNavSearchItems(
  groups: NavGroup[],
  can: (permission?: Capability) => boolean = () => true,
): SearchItem[] {
  const out: SearchItem[] = [];

  for (const group of groups) {
    for (const item of group.items) {
      if (item.items && item.items.length > 0) {
        const isPureGroup = item.items.some((s) => s.url === item.url);
        if (!isPureGroup && can(item.requiredPermission)) {
          out.push({
            id: item.url,
            kind: "navigation",
            category: group.label,
            title: item.title,
            icon: item.icon ? <span className="[&_svg]:size-4 flex">{item.icon}</span> : undefined,
            keywords: [group.label.toLowerCase(), item.title.toLowerCase()],
            url: item.url,
            capability: item.requiredPermission,
          });
        }
        for (const sub of item.items) {
          if (!sub.planned && can(sub.requiredPermission)) {
            out.push({
              id: sub.url,
              kind: "navigation",
              category: group.label,
              title: sub.title,
              subtitle: item.title,
              keywords: [
                group.label.toLowerCase(),
                item.title.toLowerCase(),
                sub.title.toLowerCase(),
              ],
              url: sub.url,
              capability: sub.requiredPermission,
            });
          }
        }
      } else {
        if (can(item.requiredPermission)) {
          out.push({
            id: item.url,
            kind: "navigation",
            category: group.label,
            title: item.title,
            icon: item.icon ? <span className="[&_svg]:size-4 flex">{item.icon}</span> : undefined,
            keywords: [group.label.toLowerCase(), item.title.toLowerCase()],
            url: item.url,
            capability: item.requiredPermission,
          });
        }
      }
    }
  }

  return out;
}

export function createNavigationSource(): SearchSource {
  return {
    id: "navigation",
    getItems(_query: string, ctx: SearchContext): SearchItem[] {
      const can = (permission?: Capability): boolean =>
        permission === undefined || ctx.capabilities.has(permission);
      return buildNavSearchItems(translateNavigation(navGroups, ctx.t), can);
    },
  };
}
