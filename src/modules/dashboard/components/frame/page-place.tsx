import { Tab, Tabs, TabsList } from "@qeetrix/react";
import { Breadcrumb, BreadcrumbItem } from "@qeetrix/react/experimental";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { filterNavigation, safeNavigation, useNavGroups } from "@/platform/config/navigation";
import { useCapabilities } from "@/platform/security/capability-provider";
import { currentNavItem, currentSubPageUrl } from "./current-page";

// Where the path sits in the navigation, and the sub-pages this person can open: what PageNav
// draws above a page not yet rebuilt, for a rebuilt page to put in its own PageHeader.
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
 * Wraps a rebuilt page that has sub-pages, so its PageHeader's `tabs` can take PageTabList (the
 * header's rule needs the list itself there). Sub-pages are separate routes, so a tab navigates;
 * links in a nav would be right, once the library has them (QTRX-19).
 */
export function PageTabs({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { current } = usePagePlace();
  return (
    <Tabs
      value={current ?? null}
      onValueChange={(url) => void navigate({ to: String(url) as never })}
    >
      {children}
    </Tabs>
  );
}

/** The page's sub-pages as tabs, each with an optional count (`badges`, by URL). */
export function PageTabList({ badges }: { badges?: Readonly<Record<string, number | undefined>> }) {
  const { t } = useTranslation("dashboard");
  const { found, subPages } = usePagePlace();
  if (!found || subPages.length < 2) return null;
  return (
    <TabsList activateOnFocus={false} aria-label={t("frame.pageViews", { page: found.item.title })}>
      {subPages.map((sub) => (
        <Tab key={sub.url} value={sub.url} badge={badges?.[sub.url] || undefined}>
          {sub.title}
        </Tab>
      ))}
    </TabsList>
  );
}
