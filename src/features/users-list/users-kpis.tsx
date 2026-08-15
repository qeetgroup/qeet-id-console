// The five KPI cards atop the Users table. Numbers and percentages are real
// (from /v1/users/stats); Total and the MFA cards carry real 30-day sparklines
// (/v1/users/trends), while the ratio-only cards (Active, Suspended) show a
// proportion meter (there is no reconstructable status history). Each card is a
// button that filters the table.

import { cn, Skeleton, Sparkline } from "@qeetrix/ui";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
  type LucideIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  UsersIcon,
  UserXIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { UserStats, UserTrends } from "@/lib/users";

export type KpiFilter = "all" | "active" | "mfa_enabled" | "mfa_missing" | "suspended";

type Tone = "brand" | "success" | "warning" | "danger";

const TONE: Record<Tone, { chip: string; icon: string; bar: string; spark: string }> = {
  brand: {
    chip: "bg-primary/10 text-primary",
    icon: "text-primary",
    bar: "bg-primary",
    spark: "var(--primary)",
  },
  success: {
    chip: "bg-success/10 text-success",
    icon: "text-success",
    bar: "bg-success",
    spark: "var(--success)",
  },
  warning: {
    chip: "bg-warning/10 text-warning",
    icon: "text-warning",
    bar: "bg-warning",
    spark: "var(--warning)",
  },
  danger: {
    chip: "bg-destructive/10 text-destructive",
    icon: "text-destructive",
    bar: "bg-destructive",
    spark: "var(--destructive)",
  },
};

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 1000) / 10 : 0;
}

export function UsersKpis({
  stats,
  trends,
  loading,
  onFilter,
}: {
  stats?: UserStats;
  trends?: UserTrends;
  loading: boolean;
  onFilter: (f: KpiFilter) => void;
}) {
  const { t } = useTranslation("users");

  if (loading && !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }
  if (!stats) return null;

  const prev = Math.max(0, stats.total - stats.new_last_30d);
  const growth = prev > 0 ? Math.round((stats.new_last_30d / prev) * 1000) / 10 : 0;
  const mfaMissingSeries =
    trends && trends.total.length === trends.mfa_enabled.length
      ? trends.total.map((v, i) => Math.max(0, v - trends.mfa_enabled[i]))
      : undefined;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        icon={UsersIcon}
        tone="brand"
        label={t("kpi.total")}
        value={stats.total}
        delta={{ value: growth, label: t("kpi.vs30d"), favorable: true }}
        sparkline={trends?.total}
        onClick={() => onFilter("all")}
      />
      <KpiCard
        icon={UserCheckIcon}
        tone="success"
        label={t("kpi.active")}
        value={stats.active}
        meter={pct(stats.active, stats.total)}
        onClick={() => onFilter("active")}
      />
      <KpiCard
        icon={ShieldCheckIcon}
        tone="success"
        label={t("kpi.mfaEnabled")}
        value={stats.mfa_enabled}
        meter={pct(stats.mfa_enabled, stats.total)}
        sparkline={trends?.mfa_enabled}
        onClick={() => onFilter("mfa_enabled")}
      />
      <KpiCard
        icon={ShieldAlertIcon}
        tone="warning"
        label={t("kpi.mfaMissing")}
        value={stats.mfa_missing}
        meter={pct(stats.mfa_missing, stats.total)}
        sparkline={mfaMissingSeries}
        onClick={() => onFilter("mfa_missing")}
      />
      <KpiCard
        icon={UserXIcon}
        tone="danger"
        label={t("kpi.suspended")}
        value={stats.suspended}
        meter={pct(stats.suspended, stats.total)}
        onClick={() => onFilter("suspended")}
      />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  tone,
  label,
  value,
  delta,
  meter,
  sparkline,
  onClick,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  value: number;
  delta?: { value: number; label: string; favorable: boolean };
  meter?: number;
  sparkline?: number[];
  onClick: () => void;
}) {
  const { t } = useTranslation("users");
  const c = TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col gap-2 overflow-hidden rounded-xl border bg-card p-4 text-left transition-colors hover:border-foreground/20 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("flex size-6 items-center justify-center rounded-md", c.chip)}>
            <Icon className={cn("size-3.5", c.icon)} aria-hidden="true" />
          </span>
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
        <ChevronRightIcon className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
      </div>

      <div className="text-2xl font-semibold tabular-nums tracking-tight">
        {value.toLocaleString()}
      </div>

      {delta ? (
        <div
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium",
            delta.favorable ? "text-success" : "text-destructive",
          )}
        >
          {delta.value >= 0 ? (
            <ArrowUpRightIcon className="size-3.5" />
          ) : (
            <ArrowDownRightIcon className="size-3.5" />
          )}
          {Math.abs(delta.value)}% {delta.label}
        </div>
      ) : meter !== undefined ? (
        <div className="text-xs text-muted-foreground">{t("kpi.ofTotal", { pct: meter })}</div>
      ) : null}

      {sparkline && sparkline.length > 1 ? (
        <div className="mt-1 h-8">
          <Sparkline
            data={sparkline}
            type="area"
            color={c.spark}
            height={32}
            className="size-full opacity-80"
          />
        </div>
      ) : meter !== undefined ? (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", c.bar)}
            style={{ width: `${Math.min(100, meter)}%` }}
          />
        </div>
      ) : (
        <div className="h-8" />
      )}
    </button>
  );
}
