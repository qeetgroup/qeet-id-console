// Summary metric strip — a server-computed windowed snapshot
// (GET /v1/activity/summary) rendered as six KPI cards, each with its own
// sparkline drawn from the per-outcome time series. Clicking an outcome card
// applies the matching severity filter. Built on the .dashboard-metric helpers.

import { cn, Skeleton, Sparkline } from "@qeetrix/ui";

import type { ActivitySearch } from "../activity-search";
import type { ActivitySummary, Outcome } from "../types/activity.types";

type Tone = "brand" | "success" | "warning" | "danger" | "info";

const TONE_TEXT: Record<Tone, string> = {
  brand: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

function pctLabel(share: number): string {
  const p = share * 100;
  if (p === 0) return "0%";
  return `${p >= 10 ? p.toFixed(1) : p.toFixed(2)}%`;
}

function compact(n: number): string {
  return n >= 10_000 ? n.toLocaleString(undefined, { notation: "compact" }) : n.toLocaleString();
}

const RAIL_CLASS =
  "grid grid-cols-2 overflow-hidden rounded-[var(--radius-lg)] border border-border/90 bg-card shadow-md sm:grid-cols-3 xl:grid-cols-6";

function MetricCard({
  label,
  value,
  tone,
  series,
  share,
  onClick,
  active,
}: {
  label: string;
  value: number;
  tone: Tone;
  series: number[];
  share?: number; // 0..1, shown as a % next to the label
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        {share !== undefined && (
          <span className={cn("shrink-0 text-[11px] tabular-nums", TONE_TEXT[tone])}>
            {pctLabel(share)}
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-semibold leading-tight tabular-nums">{compact(value)}</p>
      <div className="mt-1.5 mb-3 h-8">
        {series.length > 1 ? (
          <Sparkline data={series} type="area" height={32} className={TONE_TEXT[tone]} />
        ) : null}
      </div>
    </>
  );

  if (!onClick) {
    return (
      <div className="dashboard-metric" data-tone={tone}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "dashboard-metric text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        active && "bg-muted/50",
      )}
      data-tone={tone}
    >
      {body}
    </button>
  );
}

function StripSkeleton() {
  return (
    <div className={RAIL_CLASS} aria-busy="true">
      {["a", "b", "c", "d", "e", "f"].map((k) => (
        <div key={k} className="dashboard-metric pb-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-7 w-14" />
          <Skeleton className="mt-3 h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ActivitySummaryStrip({
  summary,
  isLoading,
  onApplyFilter,
  activeOutcome,
}: {
  summary: ActivitySummary | undefined;
  isLoading: boolean;
  /** Apply a filter patch when an outcome card is clicked. */
  onApplyFilter?: (patch: Partial<ActivitySearch>) => void;
  /** The currently-applied outcome (drives the pressed state), if any. */
  activeOutcome?: Outcome | "";
}) {
  if (isLoading && !summary) return <StripSkeleton />;
  if (!summary) return null;

  const total = summary.total;
  const success = summary.by_outcome.success ?? 0;
  const warning = summary.by_outcome.warning ?? 0;
  const failed = summary.by_outcome.failed ?? 0;
  const s = summary.series;
  // Coalesce to 0 so an older backend (total-only series) still renders.
  const seriesOf = (key: keyof (typeof s)[number]) => s.map((b) => Number(b[key] ?? 0));

  const apply = (patch: Partial<ActivitySearch>) => onApplyFilter?.(patch);

  return (
    <div className={RAIL_CLASS}>
      <MetricCard
        label="Total events"
        value={total}
        tone="brand"
        series={seriesOf("count")}
        onClick={onApplyFilter ? () => apply({ severity: undefined }) : undefined}
        active={activeOutcome === ""}
      />
      <MetricCard
        label="Success"
        value={success}
        tone="success"
        series={seriesOf("success")}
        share={total ? success / total : 0}
        onClick={onApplyFilter ? () => apply({ severity: "success" }) : undefined}
        active={activeOutcome === "success"}
      />
      <MetricCard
        label="Warnings"
        value={warning}
        tone="warning"
        series={seriesOf("warning")}
        share={total ? warning / total : 0}
        onClick={onApplyFilter ? () => apply({ severity: "warning" }) : undefined}
        active={activeOutcome === "warning"}
      />
      <MetricCard
        label="Failed"
        value={failed}
        tone="danger"
        series={seriesOf("failed")}
        share={total ? failed / total : 0}
        onClick={onApplyFilter ? () => apply({ severity: "error,critical" }) : undefined}
        active={activeOutcome === "failed"}
      />
      <MetricCard
        label="Unique actors"
        value={summary.unique_actors}
        tone="info"
        series={seriesOf("count")}
      />
      <MetricCard
        label="Security alerts"
        value={summary.security_alerts}
        tone="danger"
        series={seriesOf("critical")}
        onClick={onApplyFilter ? () => apply({ severity: "critical" }) : undefined}
      />
    </div>
  );
}
