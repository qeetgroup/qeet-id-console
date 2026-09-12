import {
  Sidebar,
  SidebarRail,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useSidebar,
} from "@qeetrix/ui";
import { QeetLogoMark } from "@qeetrix/ui/brand";
import { useLocation } from "@tanstack/react-router";
import * as React from "react";

import {
  filterNavigation,
  findNavGroupForPath,
  navGroups,
  safeNavigation,
} from "@/platform/config/navigation";
import { useCapabilities } from "@/platform/security/capability-provider";
import { AccessModeIndicator } from "@/platform/security/access-mode-indicator";

import { DirectoryNav, SectionNav, SectionNavSkeleton } from "./nav-main";
import { TeamSwitcher } from "./team-switcher";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const access = useCapabilities();
  const { pathname } = useLocation();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();

  const groups =
    access.state === "ready" ? filterNavigation(navGroups, access.can) : safeNavigation(navGroups);

  // The rail follows the current route by default; picking a rail icon lets you
  // preview another section's items without navigating. Any route change (e.g.
  // clicking an item) drops the manual pick so the panel tracks the route again.
  const routeLabel = findNavGroupForPath(groups, pathname) ?? groups[0]?.label;
  const [picked, setPicked] = React.useState<string | null>(null);
  React.useEffect(() => {
    setPicked(null);
  }, [routeLabel]);

  const activeGroup = groups.find((group) => group.label === (picked ?? routeLabel)) ?? groups[0];

  function selectGroup(label: string) {
    setPicked(label);
    // Expand from the icon-only (rail-only) state so the chosen panel is visible.
    if (isMobile) setOpenMobile(true);
    else setOpen(true);
  }

  return (
    <Sidebar collapsible="icon" className="console-sidebar" {...props}>
      <div className="console-dual flex h-full min-h-0 flex-1">
        {/* Rail: the eight section icons, always visible even when collapsed. */}
        <div className="console-rail flex h-full w-(--sidebar-width-icon) shrink-0 flex-col items-center gap-1 border-e border-sidebar-border/60 py-3">
          <a href="/" aria-label="Qeet ID overview" className="console-rail-logo">
            {/* No forced variant → the mark stays theme-adaptive on the sidebar. */}
            <QeetLogoMark size={22} title="Qeet" />
          </a>
          {/* delay lets the first hover settle; base-ui shares it across the
              group so sweeping between icons then reveals labels instantly. */}
          <TooltipProvider delay={200}>
            <nav
              aria-label="Console sections"
              className="mt-1 flex flex-1 flex-col items-center gap-1 overflow-y-auto"
            >
              {groups.map((group) => {
                const isActive = group.label === activeGroup?.label;
                return (
                  <Tooltip key={group.label}>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          aria-label={group.label}
                          aria-current={isActive ? "true" : undefined}
                          data-active={isActive ? "" : undefined}
                          onClick={() => selectGroup(group.label)}
                          className="console-rail-btn"
                        >
                          {group.icon}
                        </button>
                      }
                    />
                    <TooltipContent side="right" sideOffset={8}>
                      {group.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </nav>
          </TooltipProvider>
        </div>

        {/* Panel: only the active section's items. Hidden when collapsed to the rail. */}
        <div className="console-panel flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
          <div className="console-panel-head p-3 pb-2">
            <div className="mb-2 flex items-center gap-1.5 px-1 leading-tight">
              <span className="font-heading text-sm font-semibold tracking-tight">Qeet ID</span>
              <span className="text-sm text-sidebar-foreground/30">—</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-sidebar-foreground/45">
                Control plane
              </span>
            </div>
            <TeamSwitcher />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3">
            <div className="console-panel-title">{activeGroup?.label}</div>
            {access.state === "resolving" ? (
              <SectionNavSkeleton />
            ) : activeGroup?.label === "Directory" ? (
              <DirectoryNav group={activeGroup} />
            ) : activeGroup ? (
              <SectionNav group={activeGroup} />
            ) : null}
          </div>
          <div className="console-panel-foot border-t border-sidebar-border/50 p-3 pt-2">
            <AccessModeIndicator />
          </div>
        </div>
      </div>
      <SidebarRail />
    </Sidebar>
  );
}
