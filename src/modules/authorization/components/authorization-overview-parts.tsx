import { Badge, Card, CardContent, cn, Skeleton, TimeSince } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  CircleAlertIcon,
  type IconProps,
  InfoIcon,
  ScrollTextIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
} from "@qeetrix/icons";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import { type PolicyChange, policyChangeTitle } from "../api/policy-changes";
import type { CountTrend, PostureFinding } from "../authz-posture";

const INSIGHT_ROUTES: Record<PostureFinding["id"], string> = {
  wildcard: "/authorization/permissions",
  unconditional: "/authorization/abac",
  disabled: "/authorization/abac",
  deny: "/authorization/abac",
};

const CHIP_TONES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
} as const;

type ChipTone = keyof typeof CHIP_TONES;

export function SectionHeading({
  icon,
  tone,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  tone: ChipTone;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          CHIP_TONES[tone],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-heading text-base font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export function KpiCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  badge,
  badgeTone = "muted",
  trend,
  to,
  loading,
}: {
  icon: ComponentType<IconProps<"outline">>;
  tone: ChipTone;
  label: string;
  value: number;
  hint: string;
  badge?: string;
  badgeTone?: "muted" | "success";
  trend?: CountTrend | null;
  to: string;
  loading: boolean;
}) {
  return (
    <Link to={to} className="group/kpi min-w-0">
      <Card className="h-full gap-0 transition-colors hover:border-primary/40">
        <CardContent className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              CHIP_TONES[tone],
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{label}</p>
            {loading ? (
              <Skeleton className="mt-2 h-7 w-16" />
            ) : (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-heading text-2xl font-semibold leading-none">{value}</span>
                {trend && <TrendPill trend={trend} />}
                {badge && (
                  <Badge variant={badgeTone} className="font-normal">
                    {badge}
                  </Badge>
                )}
              </div>
            )}
            <p className="mt-1.5 truncate text-xs text-muted-foreground">{hint}</p>
          </div>
          <ChevronRightIcon
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/kpi:translate-x-0.5"
            aria-hidden="true"
          />
        </CardContent>
      </Card>
    </Link>
  );
}

/** Change across the selected window, reconstructed from the audit log. */
function TrendPill({ trend }: { trend: CountTrend }) {
  const up = trend.delta >= 0;
  const Icon = up ? TrendingUpIcon : TrendingDownIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
        up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {up ? "+" : ""}
      {trend.percent}%
    </span>
  );
}

export function HealthCounter({
  tone,
  value,
  label,
}: {
  tone: string;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-2 shrink-0 rounded-full", tone)} aria-hidden="true" />
      <span className="font-heading text-base font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function LegendDot({ tone, label, value }: { tone: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className={cn("size-2 shrink-0 rounded-full", tone)} aria-hidden="true" />
      {label}
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

const SEVERITY_META = {
  high: { icon: CircleAlertIcon, className: "text-destructive", badge: "destructive" },
  medium: { icon: TriangleAlertIcon, className: "text-warning", badge: "warning" },
  info: { icon: InfoIcon, className: "text-muted-foreground", badge: "muted" },
} as const;

export function InsightRow({ finding, loading }: { finding: PostureFinding; loading: boolean }) {
  const { t } = useTranslation("authorization");
  const meta = SEVERITY_META[finding.severity];
  const Icon = meta.icon;

  return (
    <Link
      to={INSIGHT_ROUTES[finding.id]}
      className="group/insight flex items-center gap-3 py-3 first:pt-0 last:pb-0"
    >
      <Icon className={cn("size-4 shrink-0", meta.className)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t(`overview.insights.${finding.id}.title`)}</p>
        <p className="text-xs text-muted-foreground">
          {t(`overview.insights.${finding.id}.description`)}
        </p>
      </div>
      <Badge variant={meta.badge} className="shrink-0 font-normal">
        {t(`overview.insights.severity.${finding.severity}`)}
      </Badge>
      {loading ? (
        <Skeleton className="h-4 w-6" />
      ) : (
        <span className="w-8 shrink-0 text-end font-heading text-sm font-semibold tabular-nums">
          {finding.count}
        </span>
      )}
      <ChevronRightIcon
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/insight:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

const CHANGE_DOTS: Record<PolicyChange["kind"], string> = {
  created: "bg-warning",
  updated: "bg-success",
  deleted: "bg-muted-foreground/40",
  other: "bg-primary",
};

export function RecentChanges({
  changes,
  loading,
  emptyLabel,
}: {
  changes: PolicyChange[];
  loading: boolean;
  emptyLabel: string;
}) {
  const { t } = useTranslation("authorization");
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (changes.length === 0) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <ScrollTextIcon className="size-4" aria-hidden="true" /> {emptyLabel}
      </p>
    );
  }
  return (
    <ul className="flex flex-col">
      {changes.map((change) => (
        <li key={change.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
          <span
            className={cn("mt-1.5 size-2 shrink-0 rounded-full", CHANGE_DOTS[change.kind])}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{policyChangeTitle(change)}</p>
            {change.target && (
              <p className="truncate font-mono text-xs text-muted-foreground">{change.target}</p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <p className="text-xs text-muted-foreground">
              <TimeSince value={change.at} />
            </p>
            {change.actor && (
              <p className="truncate text-xs text-muted-foreground">
                {t("overview.changes.byActor", { actor: change.actor })}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: ComponentType<IconProps<"outline">>;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="group/action flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRightIcon
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/action:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}
