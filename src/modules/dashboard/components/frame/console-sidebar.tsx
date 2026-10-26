import type { QeetrixIcon } from "@qeetrix/react";
import { Sidebar, SidebarGroup, SidebarItem } from "@qeetrix/react/experimental";
import { Link, useLocation } from "@tanstack/react-router";
import { isValidElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  filterNavigation,
  type NavGroup,
  safeNavigation,
  useNavGroups,
} from "@/platform/config/navigation";
import { AccessModeIndicator } from "@/platform/security/access-mode-indicator";
import { useCapabilities } from "@/platform/security/capability-provider";
import { currentNavItemUrl } from "./current-page";

// The manifests give icons as elements (<UsersIcon />); the Sidebar takes the component.
function iconOf(node: ReactNode): QeetrixIcon | undefined {
  return isValidElement(node) && typeof node.type !== "string"
    ? (node.type as QeetrixIcon)
    : undefined;
}

/**
 * The console's navigation (design A · Areas): the overview pages first, then each area as an
 * entry that opens to its pages. A page's own sub-pages are its tabs, not rows here. Inside the
 * AppShell it collapses to a rail and becomes a drawer on narrow screens.
 */
export function ConsoleSidebar() {
  const { t } = useTranslation("dashboard");
  const { pathname } = useLocation();
  const access = useCapabilities();
  const all = useNavGroups();
  const groups: NavGroup[] =
    access.state === "ready" ? filterNavigation(all, access.can) : safeNavigation(all);
  // Where the path is, from the whole navigation: a page someone can't open isn't listed, and its
  // area's overview mustn't take its place as current.
  const current = currentNavItemUrl(all, pathname);
  const [overview, areas] = [
    groups.filter((group) => group.id === "overview"),
    groups.filter((group) => group.id !== "overview" && group.items.length > 0),
  ];

  const page = (item: NavGroup["items"][number], withIcon: boolean) => (
    <SidebarItem
      key={item.url}
      label={item.title}
      href={item.url}
      render={<Link to={item.url as never} />}
      icon={withIcon ? iconOf(item.icon) : undefined}
      current={item.url === current}
    />
  );

  return (
    <Sidebar label={t("frame.navigation")} footer={<AccessModeIndicator />}>
      {overview.map((group) => (
        <SidebarGroup key={group.id}>{group.items.map((item) => page(item, true))}</SidebarGroup>
      ))}
      <SidebarGroup>
        {areas.map((group) => (
          // An area starts open when it holds the current page; the key reopens it once it does
          // (the pages someone may open arrive after the first render).
          <SidebarItem
            key={`${group.id}:${group.items.some((item) => item.url === current)}`}
            label={group.label}
            icon={iconOf(group.icon)}
          >
            {group.items.map((item) => page(item, false))}
          </SidebarItem>
        ))}
      </SidebarGroup>
    </Sidebar>
  );
}
