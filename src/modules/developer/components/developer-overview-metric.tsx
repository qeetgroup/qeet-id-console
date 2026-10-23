import { Button, cn, Skeleton } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { RefreshCwIcon } from "@qeetrix/icons";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart } from "recharts";

import { formatLocale } from "@/i18n";

import type { DeveloperOverviewData } from "../api/overview";
import { FOCUS, PANEL, RESOURCES } from "./developer-overview-config";

/** Renders one resource's count, its 7-day sparkline and how many were created recently. */
export function MetricCard({ resource }: { resource: DeveloperOverviewData["resources"][number] }) {
  const { t } = useTranslation("developer");
  const headingId = useId();
  const specification = RESOURCES[resource.id];
  const Icon = specification.icon;
  const metric = resource.allowed && !resource.error ? resource.data : undefined;
  const label = t(`overview.metrics.${resource.id}`);
  const color = specification.brand ? "var(--primary)" : "var(--success)";

  return (
    <article
      className={cn(PANEL, "flex min-h-23 flex-col gap-1 p-2.5")}
      aria-labelledby={headingId}
    >
      <header className="flex min-h-6 items-center gap-2">
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground",
            specification.brand && "bg-primary/8 text-primary",
            resource.id === "tokens" && "bg-emerald-500/8 text-emerald-700 dark:text-emerald-400",
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <h2 id={headingId} className="min-w-0 flex-1 text-xs leading-4 font-medium">
          {resource.allowed ? (
            <Link to={specification.path as never} className={cn(FOCUS, "rounded-sm")}>
              {label}
            </Link>
          ) : (
            label
          )}
        </h2>
      </header>
      <div className="flex min-h-7 items-center justify-between gap-2">
        {resource.loading ? (
          <Skeleton
            className="h-7 w-12"
            role="status"
            aria-label={t("overview.loadingMetric", { label })}
          />
        ) : metric ? (
          <p
            className="font-heading text-2xl leading-7 font-semibold tabular-nums"
            title={metric.total.toLocaleString(formatLocale())}
          >
            {new Intl.NumberFormat(formatLocale(), {
              notation: metric.total >= 10000 ? "compact" : "standard",
              maximumFractionDigits: 1,
            }).format(metric.total)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t(resource.allowed ? "overview.unavailable" : "overview.restricted")}
          </p>
        )}
        {resource.error ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={resource.busy}
            onClick={() => void resource.retry()}
            aria-label={t("overview.retryMetric", { label })}
          >
            <RefreshCwIcon className="size-3.5" />
          </Button>
        ) : metric?.series.length ? (
          <div className="h-7 w-14 shrink-0" aria-hidden="true">
            <AreaChart
              width={56}
              height={28}
              data={metric.series}
              margin={{ top: 2, right: 1, bottom: 2, left: 1 }}
            >
              <Area
                type="monotone"
                dataKey="count"
                stroke={metric.recent ? color : "var(--muted-foreground)"}
                strokeWidth={1.25}
                fill={color}
                fillOpacity={0.08}
                isAnimationActive={false}
              />
            </AreaChart>
          </div>
        ) : null}
      </div>
      <p className="mt-auto min-h-3 text-[10px] leading-3 text-muted-foreground">
        {metric?.recent != null
          ? t("overview.recentCreations", { count: metric.recent })
          : t("overview.historyUnavailable")}
      </p>
    </article>
  );
}
