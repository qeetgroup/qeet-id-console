import {
  cn,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@qeetrix/ui";
import { Link, useLocation } from "@tanstack/react-router";
import { ChevronRightIcon, Clock3Icon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { NavGroup, NavItem } from "@/platform/config/navigation";
import { isNavBranchActive, isNavPathActive } from "@/platform/config/navigation-state";
import { useDirectoryData } from "../api/directory";

export type NavBadge = {
  label: string;
  description: string;
  tone: "neutral" | "warning" | "success";
};

function NavigationBadge({ badge }: { badge: NavBadge }) {
  return (
    <span
      title={badge.description}
      aria-label={badge.description}
      className={cn(
        "ms-auto shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] leading-3 font-medium tabular-nums",
        badge.tone === "neutral" && "bg-sidebar-accent text-sidebar-foreground/75",
        badge.tone === "warning" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
        badge.tone === "success" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      )}
    >
      {badge.label}
    </span>
  );
}

function NavMenuItem({
  item,
  pathname,
  expandBranches,
  badges,
}: {
  item: NavItem;
  pathname: string;
  expandBranches: boolean;
  badges: Record<string, NavBadge>;
}) {
  const { t } = useTranslation("dashboard");
  const isActive = isNavPathActive(pathname, item.url);
  const isBranchActive = isNavBranchActive(pathname, item);

  if (!item.items?.length) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={item.title}
          isActive={isActive}
          className="console-nav-item"
          render={<Link to={item.url as never} aria-current={isActive ? "page" : undefined} />}
        >
          {item.icon}
          <span>{item.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible
      key={`${item.url}:${isBranchActive}:${expandBranches}`}
      defaultOpen={isBranchActive || expandBranches}
      className="group/collapsible"
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger
        render={
          <SidebarMenuButton
            tooltip={item.title}
            isActive={isBranchActive}
            className="console-nav-item"
          />
        }
      >
        {item.icon}
        <span>{item.title}</span>
        <ChevronRightIcon className="ms-auto transition-transform duration-200 ease-(--ease-decelerate) group-data-open/collapsible:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {item.items.map((subItem) => {
            const subActive = pathname === subItem.url;
            const badge = badges[subItem.url];
            const button = (
              <SidebarMenuSubButton
                isActive={subActive && !subItem.planned}
                className={cn(
                  "console-nav-subitem min-w-0 gap-1.5",
                  subItem.planned &&
                    "cursor-not-allowed aria-disabled:pointer-events-auto aria-disabled:opacity-60",
                )}
                title={badge?.description}
                render={
                  subItem.planned ? (
                    <button type="button" aria-disabled="true" />
                  ) : (
                    <Link
                      to={subItem.url as never}
                      aria-current={subActive ? "page" : undefined}
                      aria-label={badge ? `${subItem.title}: ${badge.description}` : undefined}
                    />
                  )
                }
              >
                <span>{subItem.title}</span>
                {badge ? <NavigationBadge badge={badge} /> : null}
                {subItem.planned ? (
                  <>
                    <Clock3Icon className="ms-auto size-3.5 shrink-0" aria-hidden="true" />
                    <span className="sr-only">{t("directory.planned")}</span>
                  </>
                ) : null}
              </SidebarMenuSubButton>
            );
            return (
              <SidebarMenuSubItem key={subItem.title}>
                {subItem.planned ? (
                  <Tooltip>
                    <TooltipTrigger render={button} />
                    <TooltipContent side="right">{t("directory.plannedHint")}</TooltipContent>
                  </Tooltip>
                ) : (
                  button
                )}
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Renders one group's items — the body of the two-pane sidebar's section panel.
 * The rail (in AppSidebar) selects which group lands here, so only a single
 * group is ever visible at once, which is what keeps the panel short.
 */
export function SectionNav({
  group,
  badges = {},
}: {
  group: NavGroup;
  badges?: Record<string, NavBadge>;
}) {
  const { pathname } = useLocation();

  return (
    <SidebarMenu className="gap-0.5">
      {group.items.map((item) => (
        <NavMenuItem
          key={item.title}
          item={item}
          pathname={pathname}
          expandBranches={group.label === "Directory" && pathname === "/directory"}
          badges={badges}
        />
      ))}
    </SidebarMenu>
  );
}

export function DirectoryNav({ group }: { group: NavGroup }) {
  const { t, i18n } = useTranslation("dashboard");
  const { permissions, invitations, scim, ldap } = useDirectoryData(false);
  const badges: Record<string, NavBadge> = {};

  if (permissions.invitations && invitations.isSuccess && invitations.data > 0) {
    badges["/invitations"] = {
      label: invitations.data > 99 ? "99+" : invitations.data.toLocaleString(i18n.resolvedLanguage),
      description: t("directory.status.pendingInvitations", { count: invitations.data }),
      tone: "warning",
    };
  }
  if (permissions.connections && scim.isSuccess && scim.data.token_set) {
    badges["/auth/connections/scim"] = {
      label: t("directory.status.configured"),
      description: t("directory.status.scimConfigured"),
      tone: "success",
    };
  }
  if (permissions.connections && ldap.isSuccess && ldap.data.items.length > 0) {
    const inactive = ldap.data.items.filter((connection) => connection.status !== "active").length;
    badges["/auth/connections/ldap"] = {
      label: t(inactive ? "directory.status.attention" : "directory.status.active"),
      description: t(inactive ? "directory.status.ldapAttention" : "directory.status.ldapActive", {
        count: inactive || ldap.data.items.length,
      }),
      tone: inactive ? "warning" : "success",
    };
  }

  return <SectionNav group={group} badges={badges} />;
}

const SECTION_SKELETON_ROWS = ["one", "two", "three", "four", "five"] as const;

export function SectionNavSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Checking available console sections">
      <SidebarMenu className="gap-0.5">
        {SECTION_SKELETON_ROWS.map((row) => (
          <SidebarMenuItem key={row}>
            <div className="flex h-8 items-center gap-2 rounded-md px-2" aria-hidden="true">
              <Skeleton className="size-4 shrink-0 rounded-sm bg-sidebar-foreground/10" />
              <Skeleton className="h-3 w-28 max-w-[70%] bg-sidebar-foreground/10" />
            </div>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      <span className="sr-only">Checking organization access</span>
    </div>
  );
}
