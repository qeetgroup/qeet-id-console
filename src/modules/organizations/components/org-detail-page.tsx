import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TooltipProvider,
} from "@qeetrix/ui";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  BuildingComplexIcon,
  ChevronDownIcon,
  TrashIcon,
  UserCheckIcon,
  UserXIcon,
} from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { StatusPill } from "@/platform/components/status-pill";
import { useCapabilities } from "@/platform/security/capability-provider";
import { CopyId } from "@/modules/users";
import { initials } from "@/shared/utils/initials";
import { useTenantId } from "@/platform/auth/session";
import { switchToTenant } from "@/modules/authentication";
import { type Org, useOrg } from "../api/orgs";
import { useOrgActions } from "../use-org-actions";
import { ActivityTab, BillingTab, MembersTab, OverviewTab, SecurityTab } from "./org-detail-tabs";

export const TABS = ["overview", "members", "security", "billing", "activity"] as const;

export type OrgTab = (typeof TABS)[number];

/** Renders one organization: its header, actions and the detail tabs. */
export function OrgDetailPage({
  orgId,
  tab,
  onTabChange: setTab,
}: {
  orgId: string;
  tab: OrgTab;
  onTabChange: (tab: OrgTab) => void;
}) {
  const { t } = useTranslation("organizations");
  const navigate = useNavigate();
  const currentTenantId = useTenantId();
  const isActive = orgId === currentTenantId;
  const access = useCapabilities();
  const canWrite = access.can("tenant.write");

  const { org, isLoading, isError } = useOrg(orgId);
  const actions = useOrgActions();

  return (
    <TooltipProvider>
      <div className="flex min-w-0 flex-col gap-5">
        <Link
          to="/organizations"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-3" aria-hidden="true" /> {t("detail.back")}
        </Link>

        {isLoading && !org ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : isError || !org ? (
          <EmptyState icon={BuildingComplexIcon} title={t("detail.notFound")} />
        ) : (
          <>
            <OrgHeader
              org={org}
              isActive={isActive}
              canWrite={canWrite}
              onSuspendToggle={() => actions.toggleSuspend(org)}
              onDelete={() => actions.remove(org, () => navigate({ to: "/organizations" }))}
            />

            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as OrgTab)}
              className="flex min-w-0 flex-col gap-5"
            >
              <TabsList className="w-full justify-start overflow-x-auto">
                {TABS.map((k) => (
                  <TabsTrigger key={k} value={k}>
                    {t(`detail.tabs.${k}`)}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="flex min-w-0 flex-col">
                <OverviewTab org={org} isActive={isActive} />
              </TabsContent>
              <TabsContent value="members" className="flex min-w-0 flex-col">
                {isActive ? <MembersTab orgId={org.id} /> : <SwitchGate org={org} />}
              </TabsContent>
              <TabsContent value="security" className="flex min-w-0 flex-col">
                {isActive ? <SecurityTab orgId={org.id} /> : <SwitchGate org={org} />}
              </TabsContent>
              <TabsContent value="billing" className="flex min-w-0 flex-col">
                {isActive ? <BillingTab /> : <SwitchGate org={org} />}
              </TabsContent>
              <TabsContent value="activity" className="flex min-w-0 flex-col">
                {isActive ? <ActivityTab orgId={org.id} /> : <SwitchGate org={org} />}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

function OrgHeader({
  org,
  isActive,
  canWrite,
  onSuspendToggle,
  onDelete,
}: {
  org: Org;
  isActive: boolean;
  canWrite: boolean;
  onSuspendToggle: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("organizations");
  const suspended = org.status === "suspended";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar className="size-14 rounded-xl">
            {org.logo_url ? <AvatarImage src={org.logo_url} alt={org.name} /> : null}
            <AvatarFallback className="rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
              {initials(org.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">{org.name}</h1>
              <StatusPill status={org.status} dot />
              <Badge variant="muted" className="capitalize">
                {org.plan}
              </Badge>
              {isActive ? <Badge variant="success">{t("tenants.table.current")}</Badge> : null}
            </div>
            <div className="mt-0.5 font-mono text-sm text-muted-foreground">{org.slug}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isActive ? (
            <Button variant="outline" size="sm" onClick={() => void switchToTenant(org.id)}>
              <ArrowLeftRightIcon className="size-4" />
              {t("tenants.table.switch")}
            </Button>
          ) : null}
          {canWrite ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    {t("detail.actions")}
                    <ChevronDownIcon className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem onClick={onSuspendToggle}>
                  {suspended ? <UserCheckIcon /> : <UserXIcon />}
                  {suspended ? t("rowActions.activate") : t("rowActions.suspend")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" disabled={isActive} onClick={onDelete}>
                  <TrashIcon />
                  {t("rowActions.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {/* Meta strip */}
      <div className="grid grid-cols-2 divide-x divide-y divide-border rounded-xl border sm:grid-cols-4 sm:divide-y-0">
        <MetaCell label={t("preview.plan")}>
          <span className="capitalize">{org.plan}</span>
        </MetaCell>
        <MetaCell label={t("preview.region")}>{org.region || "—"}</MetaCell>
        <MetaCell label={t("preview.members")}>{org.member_count ?? "—"}</MetaCell>
        <MetaCell label={t("detail.orgId")}>
          <CopyId value={org.id} label={t("preview.copyId")} />
        </MetaCell>
      </div>
    </div>
  );
}

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 min-w-0 text-sm font-medium">{children}</div>
    </div>
  );
}

// Shown for an organization other than the active one.

function SwitchGate({ org }: { org: Org }) {
  const { t } = useTranslation("organizations");
  return (
    <div className="rounded-xl border bg-card p-8">
      <EmptyState
        icon={ArrowLeftRightIcon}
        title={t("detail.switchGateTitle")}
        description={t("detail.switchGateDesc", { name: org.name })}
        action={
          <Button size="sm" onClick={() => void switchToTenant(org.id)}>
            <ArrowLeftRightIcon className="size-4" />
            {t("tenants.table.switch")}
          </Button>
        }
      />
    </div>
  );
}
