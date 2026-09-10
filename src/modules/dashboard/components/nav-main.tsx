import { ArrowRightAlt } from "@qeetrix/icons";
import {
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
} from "@qeetrix/ui";
import { Link, useLocation } from "@tanstack/react-router";

import type { NavGroup, NavItem } from "@/platform/config/navigation";
import { isNavBranchActive, isNavPathActive } from "@/platform/config/navigation-state";

function NavMenuItem({ item, pathname }: { item: NavItem; pathname: string }) {
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
      key={`${item.url}:${isBranchActive}`}
      defaultOpen={isBranchActive}
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
        <ArrowRightAlt className="ms-auto transition-transform duration-200 ease-(--ease-decelerate) group-data-open/collapsible:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {item.items.map((subItem) => {
            const subActive = pathname === subItem.url;
            return (
              <SidebarMenuSubItem key={subItem.title}>
                <SidebarMenuSubButton
                  isActive={subActive}
                  className="console-nav-subitem"
                  render={
                    <Link to={subItem.url as never} aria-current={subActive ? "page" : undefined} />
                  }
                >
                  <span>{subItem.title}</span>
                </SidebarMenuSubButton>
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
export function SectionNav({ group }: { group: NavGroup }) {
  const { pathname } = useLocation();

  return (
    <SidebarMenu className="gap-0.5">
      {group.items.map((item) => (
        <NavMenuItem key={item.title} item={item} pathname={pathname} />
      ))}
    </SidebarMenu>
  );
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
