import { TabNav, TabNavLink } from "@qeetrix/react";
import { Breadcrumb, BreadcrumbItem } from "@qeetrix/react/experimental";
import { Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { filterNavigation, safeNavigation, useNavGroups } from "@/platform/config/navigation";
import { useCapabilities } from "@/platform/security/capability-provider";
import { currentNavItem, currentSubPageUrl } from "./current-page";

// Where the path sits in the navigation, and the sub-pages this person can open, for a page to put
// in its own PageHeader.
function usePagePlace() {
  const { pathname } = useLocation();
  const access = useCapabilities();
  const all = useNavGroups();
  const groups = access.state === "ready" ? filterNavigation(all, access.can) : safeNavigation(all);
  const found = currentNavItem(all, pathname);
  const visible = found && groups.flatMap((g) => g.items).find((c) => c.url === found.item.url);
  return {
    found,
    subPages: visible?.items ?? [],
    current: found ? currentSubPageUrl(found.item, pathname) : undefined,
  };
}

/** A rebuilt page's breadcrumb, area › page, for its PageHeader's `breadcrumb`. */
export function PageBreadcrumb() {
  const { t } = useTranslation("dashboard");
  const { found } = usePagePlace();
  if (!found) return null;
  return (
    <Breadcrumb label={t("frame.breadcrumb")}>
      <BreadcrumbItem>{found.group.label}</BreadcrumbItem>
      <BreadcrumbItem href={found.item.url} render={<Link to={found.item.url as never} />}>
        {found.item.title}
      </BreadcrumbItem>
    </Breadcrumb>
  );
}

/**
 * The page's sub-pages, for its PageHeader's `tabs`: each is a route of its own, so they're links in
 * a TabNav, each with an optional count (`badges`, by URL). The current one is the deepest sub-page
 * holding the path; links match exactly, so a parent's link isn't marked on a child's page.
 */
export function PageTabList({ badges }: { badges?: Readonly<Record<string, number | undefined>> }) {
  const { t } = useTranslation("dashboard");
  const { found, subPages, current } = usePagePlace();
  if (!found || subPages.length < 2) return null;
  return (
    <TabNav aria-label={t("frame.pageViews", { page: found.item.title })}>
      {subPages.map((sub) => (
        <TabNavLink
          key={sub.url}
          current={sub.url === current}
          badge={badges?.[sub.url] || undefined}
          render={<Link to={sub.url as never} activeOptions={{ exact: true }} />}
        >
          {sub.title}
        </TabNavLink>
      ))}
    </TabNav>
  );
}
