import { Badge, buttonVariants, cn, EmptyState, Skeleton } from "@qeetrix/ui";
import { HealthGauge, healthColor, healthText, stateFromScore } from "./health-gauge";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
  HeartPulseIcon,
  type IconProps,
  ShieldCheckIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "@qeetrix/icons";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import type { AnalyticsOverview } from "../api/analytics";

import {
  computeIdentityHealth,
  deriveAttentionItems,
  deriveSecuritySignals,
  deriveSessionStats,
  type InsightSeverity,
} from "../dashboard-insights";
import { DashboardPanel } from "./dashboard-panel";
import type { TranslationKey } from "@/i18n";

const severityStyles: Record<
  InsightSeverity,
  { chip: string; icon: ComponentType<IconProps<"outline">>; badge: string; label: TranslationKey }
> = {
  critical: {
    chip: "bg-destructive/10 text-destructive ring-destructive/15",
    icon: TriangleAlertIcon,
    badge: "bg-destructive/10 text-destructive",
    label: "dashboard:insights.severity.critical",
  },
  warning: {
    chip: "bg-warning/10 text-warning ring-warning/15",
    icon: TriangleAlertIcon,
    badge: "bg-warning/10 text-warning",
    label: "dashboard:insights.severity.warning",
  },
  info: {
    chip: "bg-info/10 text-info ring-info/15",
    icon: SparklesIcon,
    badge: "bg-info/10 text-info",
    label: "dashboard:insights.severity.info",
  },
};

const SKELETON_ROWS = ["a", "b", "c", "d"] as const;

export function AttentionRequiredPanel({
  overview,
  loading,
  className,
}: {
  overview?: AnalyticsOverview;
  loading: boolean;
  className?: string;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const items = overview ? deriveAttentionItems(overview) : [];

  return (
    <DashboardPanel
      className={className}
      title={t("insights.attentionRequired")}
      description={t("insights.signalsFromLiveTelemetry")}
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
            icon={ShieldCheckIcon}
            title={t("insights.nothingNeedsAttention")}
            description={t("insights.everyMonitoredSignalIs")}
          />
        </div>
      ) : (
        <ul
          className="divide-y divide-border/60"
          aria-label={t("insights.itemsRequiringAttention")}
        >
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
                      <span className="truncate text-sm font-semibold">{i18n.t(item.title)}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          style.badge,
                        )}
                      >
                        {i18n.t(style.label)}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {i18n.t(item.detail, item.params)}
                    </span>
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                      {i18n.t(item.actionLabel)}
                      <ChevronRightIcon className="size-3 transition-transform duration-150 group-hover:translate-x-0.5" />
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

export function IdentityHealthPanel({
  overview,
  loading,
  className,
}: {
  overview?: AnalyticsOverview;
  loading: boolean;
  className?: string;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const health = overview ? computeIdentityHealth(overview) : null;

  return (
    <DashboardPanel
      className={className}
      title={t("insights.identityHealth")}
      description={t("insights.compositePostureAcrossYour")}
      action={<HeartPulseIcon className="size-4 text-muted-foreground" aria-hidden="true" />}
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
            <HealthGauge
              score={health.score}
              ariaLabel={t("insights.healthScore", { score: health.score })}
            />
            <div className="min-w-0">
              <p className={cn("text-lg font-semibold", healthText[stateFromScore(health.score)])}>
                {t(`insights.grade.${health.grade}`)}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("insights.weightedAcrossAuthenticationReliability")}
              </p>
            </div>
          </div>
          <ul className="space-y-3">
            {health.areas.map((area) => (
              <li key={area.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{i18n.t(area.label)}</span>
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

export function SessionOverviewPanel({
  overview,
  loading,
  className,
}: {
  overview?: AnalyticsOverview;
  loading: boolean;
  className?: string;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const stats = overview ? deriveSessionStats(overview) : [];

  return (
    <DashboardPanel
      className={className}
      title={t("insights.sessionOverview")}
      description={t("insights.activeSessionFootprint")}
      action={
        <Link to="/security/sessions" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          {t("insights.manage")}
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
                  {i18n.t(stat.label)}
                </span>
                {stat.hint ? (
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground/70">
                    {i18n.t(stat.hint)}
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
  const { t, i18n } = useTranslation("dashboard");
  const signals = overview ? deriveSecuritySignals(overview) : [];

  return (
    <DashboardPanel
      className={className}
      title={t("insights.securityPosture")}
      description={t("insights.authenticationRiskAtAGlance")}
      action={
        <Link to="/security" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          {t("insights.security")}
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
              signal.delta === undefined
                ? null
                : signal.delta > 0
                  ? ArrowUpRightIcon
                  : ArrowDownRightIcon;
            return (
              <li
                key={signal.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5"
              >
                <span className="min-w-0 text-xs font-medium text-muted-foreground">
                  {i18n.t(signal.label)}
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
