import type { ComponentType, SVGProps } from "react";
import {
  ArrowRightAlt,
  Danger,
  Flash,
  Global,
  Health,
  Key,
  Layer,
  MagicStar,
  People,
  ShieldTick,
  TrendDown,
  TrendUp,
} from "@qeetrix/icons";
import { Badge, buttonVariants, cn, EmptyState, Skeleton } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";

import type { AnalyticsOverview } from "../api/analytics";
import { useEntitlements, useUsage } from "@/modules/billing";
import { useDomains } from "@/modules/organizations";
import { useOidcClients } from "@/modules/authentication";
import { useSamlConnections } from "@/modules/authentication";
import { useScimConfig } from "@/modules/authentication";

import {
  computeIdentityHealth,
  deriveAttentionItems,
  deriveSecuritySignals,
  deriveSessionStats,
  type HealthState,
  type InsightSeverity,
} from "../dashboard-insights";
import { DashboardPanel } from "./dashboard-panel";

// ---------------------------------------------------------------------------
// Shared tone maps — kept in one place so every insight panel reads the same
// ---------------------------------------------------------------------------

/** Any `@qeetrix/icons` component, as a prop. */
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const severityStyles: Record<
  InsightSeverity,
  { chip: string; icon: IconComponent; badge: string; label: string }
> = {
  critical: {
    chip: "bg-destructive/10 text-destructive ring-destructive/15",
    icon: Danger,
    badge: "bg-destructive/10 text-destructive",
    label: "Critical",
  },
  warning: {
    chip: "bg-warning/10 text-warning ring-warning/15",
    icon: Danger,
    badge: "bg-warning/10 text-warning",
    label: "Warning",
  },
  info: {
    chip: "bg-info/10 text-info ring-info/15",
    icon: MagicStar,
    badge: "bg-info/10 text-info",
    label: "Notice",
  },
};

const healthColor: Record<HealthState, string> = {
  healthy: "var(--success)",
  attention: "var(--warning)",
  critical: "var(--destructive)",
};

const healthText: Record<HealthState, string> = {
  healthy: "text-success",
  attention: "text-warning",
  critical: "text-destructive",
};

function stateFromScore(score: number): HealthState {
  if (score >= 75) return "healthy";
  if (score >= 50) return "attention";
  return "critical";
}

const SKELETON_ROWS = ["a", "b", "c", "d"] as const;

// ---------------------------------------------------------------------------
// Attention required
// ---------------------------------------------------------------------------

export function AttentionRequiredPanel({
  overview,
  loading,
  className,
}: {
  overview?: AnalyticsOverview;
  loading: boolean;
  className?: string;
}) {
  const items = overview ? deriveAttentionItems(overview) : [];

  return (
    <DashboardPanel
      className={className}
      title="Attention required"
      description="Signals from live telemetry that need an operator's eyes"
      action={
        items.length > 0 ? (
          <Badge className={cn("shrink-0", severityStyles.warning.badge)}>{items.length}</Badge>
        ) : null
      }
      contentClassName="p-0 sm:p-0"
    >
      {loading || !overview ? (
        <ul className="divide-y divide-border/60" aria-hidden="true">
          {SKELETON_ROWS.slice(0, 3).map((id) => (
            <li key={id} className="flex items-start gap-3 px-4 py-3.5 sm:px-4.5">
              <Skeleton className="size-8 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-40 max-w-full" />
                <Skeleton className="h-2.5 w-56 max-w-full" />
              </div>
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="flex min-h-52 items-center justify-center px-6 py-10">
          <EmptyState
            icon={ShieldTick}
            title="Nothing needs attention"
            description="Every monitored signal is within its healthy range right now."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border/60" aria-label="Items requiring attention">
          {items.map((item) => {
            const style = severityStyles[item.severity];
            const Icon = style.icon;
            return (
              <li key={item.id}>
                <Link
                  to={item.to as never}
                  className="group flex items-start gap-3 px-4 py-3.5 outline-none transition-colors duration-150 hover:bg-muted/40 focus-visible:bg-muted/40 sm:px-4.5"
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ring-1 [&_svg]:size-4",
                      style.chip,
                    )}
                    aria-hidden="true"
                  >
                    <Icon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{item.title}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          style.badge,
                        )}
                      >
                        {style.label}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {item.detail}
                    </span>
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                      {item.actionLabel}
                      <ArrowRightAlt className="size-3 transition-transform duration-150 group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardPanel>
  );
}

// ---------------------------------------------------------------------------
// Identity health — composite gauge + subsystem breakdown
// ---------------------------------------------------------------------------

function HealthGauge({ score }: { score: number }) {
  const size = 116;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const state = stateFromScore(score);
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Identity health score ${score} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
          opacity={0.6}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={healthColor[state]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-3xl font-semibold leading-none tabular-nums">
          {score}
        </span>
        <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

export function IdentityHealthPanel({
  overview,
  loading,
  className,
}: {
  overview?: AnalyticsOverview;
  loading: boolean;
  className?: string;
}) {
  const health = overview ? computeIdentityHealth(overview) : null;

  return (
    <DashboardPanel
      className={className}
      title="Identity health"
      description="Composite posture across your identity subsystems"
      action={<Health className="size-4 text-muted-foreground" aria-hidden="true" />}
    >
      {loading || !health ? (
        <div className="flex flex-col items-center gap-5">
          <Skeleton className="size-28 rounded-full" />
          <div className="w-full space-y-3">
            {SKELETON_ROWS.slice(0, 3).map((id) => (
              <Skeleton key={id} className="h-8 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <HealthGauge score={health.score} />
            <div className="min-w-0">
              <p className={cn("text-lg font-semibold", healthText[stateFromScore(health.score)])}>
                {health.grade}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Weighted across authentication reliability, MFA coverage, and engagement.
              </p>
            </div>
          </div>
          <ul className="space-y-3">
            {health.areas.map((area) => (
              <li key={area.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{area.label}</span>
                  <span className={cn("font-mono tabular-nums", healthText[area.state])}>
                    {area.score}
                  </span>
                </div>
                <div className="dashboard-method-track">
                  <div
                    className="dashboard-method-fill w-full"
                    style={{
                      backgroundColor: healthColor[area.state],
                      transform: `scaleX(${Math.max(0, Math.min(100, area.score)) / 100})`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardPanel>
  );
}

// ---------------------------------------------------------------------------
// Session overview
// ---------------------------------------------------------------------------

export function SessionOverviewPanel({
  overview,
  loading,
  className,
}: {
  overview?: AnalyticsOverview;
  loading: boolean;
  className?: string;
}) {
  const stats = overview ? deriveSessionStats(overview) : [];

  return (
    <DashboardPanel
      className={className}
      title="Session overview"
      description="Active session footprint"
      action={
        <Link to="/security/sessions" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Manage
        </Link>
      }
    >
      {loading || !overview ? (
        <div className="space-y-3">
          {SKELETON_ROWS.map((id) => (
            <div key={id} className="flex items-center justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      ) : (
        <dl className="space-y-3.5">
          {stats.map((stat) => (
            <div key={stat.id} className="flex items-baseline justify-between gap-3">
              <dt className="min-w-0">
                <span className="block truncate text-xs font-medium text-muted-foreground">
                  {stat.label}
                </span>
                {stat.hint ? (
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground/70">
                    {stat.hint}
                  </span>
                ) : null}
              </dt>
              <dd className="shrink-0 font-heading text-lg font-semibold tabular-nums">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </DashboardPanel>
  );
}

// ---------------------------------------------------------------------------
// Security posture
// ---------------------------------------------------------------------------

const securityText: Record<"success" | "warning" | "danger", string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

export function SecurityPosturePanel({
  overview,
  loading,
  className,
}: {
  overview?: AnalyticsOverview;
  loading: boolean;
  className?: string;
}) {
  const signals = overview ? deriveSecuritySignals(overview) : [];

  return (
    <DashboardPanel
      className={className}
      title="Security posture"
      description="Authentication risk at a glance"
      action={
        <Link to="/security" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Security
        </Link>
      }
    >
      {loading || !overview ? (
        <div className="space-y-3">
          {SKELETON_ROWS.slice(0, 3).map((id) => (
            <Skeleton key={id} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {signals.map((signal) => {
            const DeltaIcon =
              signal.delta === undefined ? null : signal.delta > 0 ? TrendUp : TrendDown;
            return (
              <li
                key={signal.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5"
              >
                <span className="min-w-0 text-xs font-medium text-muted-foreground">
                  {signal.label}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "font-heading text-base font-semibold tabular-nums",
                      securityText[signal.intent],
                    )}
                  >
                    {signal.value}
                  </span>
                  {DeltaIcon && signal.delta !== undefined ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums",
                        signal.favorable
                          ? "bg-success/10 text-success"
                          : "bg-destructive/10 text-destructive",
                      )}
                    >
                      <DeltaIcon className="size-2.5" aria-hidden="true" />
                      {Math.abs(signal.delta).toFixed(1)}%
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardPanel>
  );
}

// ---------------------------------------------------------------------------
// Enterprise connectivity — real federation & provisioning counts
// ---------------------------------------------------------------------------

type EnterpriseTile = {
  id: string;
  icon: IconComponent;
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
        <ArrowRightAlt className="size-3.5 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
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
  const saml = useSamlConnections();
  const oidc = useOidcClients();
  const scim = useScimConfig();
  const domains = useDomains();

  const tiles: EnterpriseTile[] = [
    {
      id: "saml",
      icon: Flash,
      label: "SAML connections",
      count: saml.data?.items.length,
      loading: saml.isLoading,
      to: "/auth/connections/saml",
    },
    {
      id: "oidc",
      icon: Layer,
      label: "OIDC clients",
      count: oidc.data?.items.length,
      loading: oidc.isLoading,
      to: "/auth/connections/oidc",
    },
    {
      id: "scim",
      icon: People,
      label: "SCIM provisioned",
      count: scim.data?.provisioned_count,
      loading: scim.isLoading,
      to: "/auth/connections/scim",
    },
    {
      id: "domains",
      icon: Global,
      label: "Verified domains",
      count: domains.data?.items.filter((d) => d.verified_at).length,
      loading: domains.isLoading,
      to: "/settings/organization/domains",
    },
  ];

  return (
    <DashboardPanel
      className={className}
      title="Enterprise connectivity"
      description="Federation & provisioning across your organization"
      action={
        <Link to="/auth/connections" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Manage
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

// ---------------------------------------------------------------------------
// Plan usage — real consumption vs plan limits
// ---------------------------------------------------------------------------

const USAGE_RESOURCES: { key: string; label: string; icon: IconComponent }[] = [
  { key: "seats", label: "Members", icon: People },
  { key: "apps", label: "Applications", icon: Layer },
  { key: "api_keys", label: "API keys", icon: Key },
  { key: "custom_roles", label: "Custom roles", icon: ShieldTick },
];

export function PlanUsagePanel({ className }: { className?: string }) {
  const usageQ = useUsage();
  const entQ = useEntitlements();
  const loading = usageQ.isLoading || entQ.isLoading;
  const usage = usageQ.data?.usage ?? {};
  const limits = entQ.data?.limits ?? {};
  const plan = entQ.data?.plan;

  return (
    <DashboardPanel
      className={className}
      title="Plan usage"
      description={
        plan ? `Consumption on the ${plan} plan` : "Consumption against your plan limits"
      }
      action={
        <Link to="/settings/billing" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Manage plan
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
                    {label}
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
