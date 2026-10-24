import { useTranslation } from "react-i18next";
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Skeleton,
  useSidebar,
} from "@qeetrix/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BuildingComplexIcon, CheckIcon, ChevronsUpDownIcon, PlusIcon } from "@qeetrix/icons";

import { useTenantId } from "@/platform/auth/session";
import { switchToTenant } from "@/modules/authentication";
import { usePlanName } from "@/modules/billing";
import { orgQueries } from "@/modules/organizations";

function initialOf(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

export function TeamSwitcher() {
  const { t } = useTranslation("dashboard");
  const { isMobile } = useSidebar();
  const activeId = useTenantId();

  const tenantsQ = useQuery(orgQueries.list()); // only the caller's orgs
  const planName = usePlanName();

  const tenants = tenantsQ.data?.items ?? [];
  const active = tenants.find((t) => t.id === activeId) ?? tenants[0];

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="h-13 border border-sidebar-border/70 bg-white/3 px-2.5 data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            {/* The initial repeats the name beside it, so it isn't read as part of the name. */}
            <div
              className="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/18%)]"
              aria-hidden="true"
            >
              {active?.logo_url ? (
                <img src={active.logo_url} alt="" className="size-full object-cover" />
              ) : active ? (
                initialOf(active.name)
              ) : (
                <BuildingComplexIcon className="size-4" />
              )}
            </div>
            <div className="grid flex-1 text-start text-sm leading-tight">
              {tenantsQ.isLoading ? (
                <>
                  {/* Names the button while the organizations load. */}
                  <span className="sr-only">{t("teamSwitcher.organizations")}</span>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-1 h-3 w-16" />
                </>
              ) : active ? (
                <>
                  <span className="truncate font-medium">{active.name}</span>
                  <span className="truncate text-[10px] capitalize text-muted-foreground">
                    {planName(active.plan)} · {active.region}
                  </span>
                </>
              ) : (
                <>
                  <span className="truncate font-medium">{t("teamSwitcher.noOrganization")}</span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {t("teamSwitcher.createATenantBoundary")}
                  </span>
                </>
              )}
            </div>
            <ChevronsUpDownIcon className="ms-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {t("teamSwitcher.organizations")}
              </DropdownMenuLabel>
              {tenants.length === 0 && !tenantsQ.isLoading ? (
                <DropdownMenuItem disabled className="gap-2 p-2">
                  <span className="text-sm text-muted-foreground">
                    {t("teamSwitcher.noOrganizationsYet")}
                  </span>
                </DropdownMenuItem>
              ) : (
                tenants.slice(0, 9).map((tenant) => {
                  const isActive = tenant.id === activeId;
                  return (
                    <DropdownMenuItem
                      key={tenant.id}
                      onClick={() => {
                        if (!isActive) void switchToTenant(tenant.id);
                      }}
                      className={cn("gap-2 p-2", isActive && "bg-accent/40")}
                      aria-current={isActive ? "true" : undefined}
                    >
                      <div className="flex size-6 items-center justify-center overflow-hidden rounded-md border text-xs font-semibold">
                        {tenant.logo_url ? (
                          <img src={tenant.logo_url} alt="" className="size-full object-cover" />
                        ) : (
                          initialOf(tenant.name)
                        )}
                      </div>
                      <span className="truncate">{tenant.name}</span>
                      {isActive && (
                        <CheckIcon
                          aria-label={t("teamSwitcher.currentOrganization")}
                          className="ms-auto size-4 text-emerald-600 dark:text-emerald-400"
                        />
                      )}
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link to="/organizations" />} className="gap-2 p-2">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <PlusIcon className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">
                  {t("teamSwitcher.addOrganization")}
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
