import { buttonVariants, cn, Skeleton } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  GlobeIcon,
  type IconProps,
  KeyRoundIcon,
  LayersIcon,
  PlugZapIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "@qeetrix/icons";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import { useEntitlements, useUsage } from "@/modules/billing";
import { useDomains } from "@/modules/organizations";
import { useOidcClients, useSamlConnections, useScimConfig } from "@/modules/authentication";

import { DashboardPanel } from "./dashboard-panel";

type EnterpriseTile = {
  id: string;
  icon: ComponentType<IconProps<"outline">>;
  label: string;
  count: number | undefined;
  loading: boolean;
  to: string;
};

function EnterpriseStat({ tile }: { tile: EnterpriseTile }) {
  return (
    <Link
      to={tile.to as never}
      className="group flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/25 p-3 outline-none transition-colors duration-150 hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center justify-between">
        <span className="grid size-8 place-items-center rounded-lg bg-background text-muted-foreground ring-1 ring-border/70 [&_svg]:size-4">
          <tile.icon aria-hidden="true" />
        </span>
        <ChevronRightIcon className="size-3.5 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
      </span>
      {tile.loading ? (
        <Skeleton className="h-7 w-10" />
      ) : (
        <span className="font-heading text-2xl font-semibold leading-none tabular-nums">
          {(tile.count ?? 0).toLocaleString("en-US")}
        </span>
      )}
      <span className="text-[11px] font-medium text-muted-foreground">{tile.label}</span>
    </Link>
  );
}

export function EnterpriseOverviewPanel({ className }: { className?: string }) {
  const { t } = useTranslation("dashboard");
  const saml = useSamlConnections();
  const oidc = useOidcClients();
  const scim = useScimConfig();
  const domains = useDomains();

  const tiles: EnterpriseTile[] = [
    {
      id: "saml",
      icon: PlugZapIcon,
      label: t("insights.samlConnections"),
      count: saml.data?.items.length,
      loading: saml.isLoading,
      to: "/auth/connections/saml",
    },
    {
      id: "oidc",
      icon: LayersIcon,
      label: t("insights.oidcClients"),
      count: oidc.data?.items.length,
      loading: oidc.isLoading,
      to: "/auth/connections/oidc",
    },
    {
      id: "scim",
      icon: UsersIcon,
      label: t("insights.scimProvisioned"),
      count: scim.data?.provisioned_count,
      loading: scim.isLoading,
      to: "/auth/connections/scim",
    },
    {
      id: "domains",
      icon: GlobeIcon,
      label: t("insights.verifiedDomains"),
      count: domains.data?.items.filter((d) => d.verified_at).length,
      loading: domains.isLoading,
      to: "/settings/organization/domains",
    },
  ];

  return (
    <DashboardPanel
      className={className}
      title={t("insights.enterpriseConnectivity")}
      description={t("insights.federationProvisioningAcrossYourOrganization")}
      action={
        <Link to="/auth/connections" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          {t("insights.manage")}
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <EnterpriseStat key={tile.id} tile={tile} />
        ))}
      </div>
    </DashboardPanel>
  );
}

// `key` is the billing resource; `label` its catalogue key.
const USAGE_RESOURCES: { key: string; label: string; icon: ComponentType<IconProps<"outline">> }[] =
  [
    { key: "seats", label: "dashboard:insights.usage.seats", icon: UsersIcon },
    { key: "apps", label: "dashboard:insights.usage.apps", icon: LayersIcon },
    { key: "api_keys", label: "dashboard:insights.usage.apiKeys", icon: KeyRoundIcon },
    { key: "custom_roles", label: "dashboard:insights.usage.customRoles", icon: ShieldCheckIcon },
  ];

export function PlanUsagePanel({ className }: { className?: string }) {
  const { t } = useTranslation("dashboard");
  const usageQ = useUsage();
  const entQ = useEntitlements();
  const loading = usageQ.isLoading || entQ.isLoading;
  const usage = usageQ.data?.usage ?? {};
  const limits = entQ.data?.limits ?? {};
  const plan = entQ.data?.plan;

  return (
    <DashboardPanel
      className={className}
      title={t("insights.planUsage")}
      description={
        plan ? t("insights.planConsumption", { plan }) : t("insights.planConsumptionDefault")
      }
      action={
        <Link to="/settings/billing" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          {t("insights.managePlan")}
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-4">
          {USAGE_RESOURCES.map(({ key }) => (
            <div key={key} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-3.5">
          {USAGE_RESOURCES.map(({ key, label, icon: Icon }) => {
            const used = usage[key] ?? 0;
            const limit = limits[key] ?? -1;
            const unlimited = limit < 0;
            const atLimit = !unlimited && used >= limit;
            const pct = unlimited ? 0 : Math.min(100, limit === 0 ? 100 : (used / limit) * 100);
            return (
              <li key={key} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                    <Icon className="size-3.5" aria-hidden="true" />
                    {t(label)}
                  </span>
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      atLimit ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {used.toLocaleString("en-US")}
                    {unlimited ? " / ∞" : ` / ${limit.toLocaleString("en-US")}`}
                  </span>
                </div>
                <div className="dashboard-method-track">
                  <div
                    className={cn("dashboard-method-fill w-full", unlimited && "opacity-40")}
                    style={{
                      backgroundColor: atLimit ? "var(--destructive)" : "var(--primary)",
                      transform: `scaleX(${unlimited ? 0.06 : pct / 100})`,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardPanel>
  );
}
