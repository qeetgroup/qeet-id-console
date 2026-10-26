import { Tab, Tabs, TabsList } from "@qeetrix/react";
import { Breadcrumb, BreadcrumbItem } from "@qeetrix/react/experimental";
import { Link, useLocation, useMatches, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { filterNavigation, safeNavigation, useNavGroups } from "@/platform/config/navigation";
import { useCapabilities } from "@/platform/security/capability-provider";
import { currentNavItem, currentSubPageUrl } from "./current-page";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /** The page draws its own PageHeader (with breadcrumb and tabs), so the frame draws neither. */
    pageHeader?: boolean;
  }
}

/**
 * Where a page sits, above a page not yet rebuilt: the breadcrumb (area › page) and, for a page
 * with sub-pages, their tabs. A rebuilt page sets `staticData: { pageHeader: true }` and puts the
 * same in its PageHeader. Sub-pages are separate routes, so a tab navigates.
 */
export function PageNav() {
  const { t } = useTranslation("dashboard");
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const ownHeader = useMatches({
    select: (matches) => matches.some((m) => m.staticData?.pageHeader),
  });
  const access = useCapabilities();
  const all = useNavGroups();
  const groups = access.state === "ready" ? filterNavigation(all, access.can) : safeNavigation(all);
  // Located in the whole navigation, so a page someone can't open still names itself; its tabs
  // are the sub-pages they can.
  const found = currentNavItem(all, pathname);
  if (ownHeader || !found) return null;

  const { group, item } = found;
  const visible = groups.flatMap((g) => g.items).find((candidate) => candidate.url === item.url);
  const subPages = visible?.items ?? [];
  const current = currentSubPageUrl(item, pathname);
  // Tabs are for the sub-pages themselves; a record's page under one (a user) gets the breadcrumb.
  const onSubPage = subPages.some((sub) => sub.url === pathname);
  const onPage = pathname === item.url;
  return (
    <div className="frame-page-nav">
      <Breadcrumb label={t("frame.breadcrumb")}>
        <BreadcrumbItem>{group.label}</BreadcrumbItem>
        {onPage ? (
          <BreadcrumbItem current>{item.title}</BreadcrumbItem>
        ) : (
          <BreadcrumbItem href={item.url} render={<Link to={item.url as never} />}>
            {item.title}
          </BreadcrumbItem>
        )}
      </Breadcrumb>
      {onSubPage && subPages.length > 1 && (
        <Tabs
          value={current ?? null}
          onValueChange={(url) => void navigate({ to: String(url) as never })}
        >
          <TabsList activateOnFocus={false} aria-label={t("frame.pageViews", { page: item.title })}>
            {subPages.map((sub) => (
              <Tab key={sub.url} value={sub.url}>
                {sub.title}
              </Tab>
            ))}
          </TabsList>
        </Tabs>
      )}
    </div>
  );
}
