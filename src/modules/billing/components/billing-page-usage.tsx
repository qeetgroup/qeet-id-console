import { Button, cn, Skeleton } from "@qeetrix/ui";
import {
  ArrowDownToLineIcon,
  KeyRoundIcon,
  LayersIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "@qeetrix/icons";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { exportToCsv } from "@/shared/utils/data-export";
import type { Entitlements } from "../api/billing";
import { BILLING_RESOURCES, billingUsage } from "../billing-model";
import { BillingErrorState } from "./billing-page-parts";

const SURFACE =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 shadow-xs dark:bg-card/70 dark:shadow-none";
const ACTION =
  "h-8 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";
const RESOURCE_ICONS = {
  seats: UsersIcon,
  apps: LayersIcon,
  api_keys: KeyRoundIcon,
  custom_roles: ShieldCheckIcon,
};

/** A meter per plan-limited resource, with a CSV export of usage against the limits. */
export function BillingUsage({
  id,
  ref,
  usage,
  entitlements,
  loading,
  error,
  fetching,
  onRetry,
}: {
  id: string;
  ref: Ref<HTMLElement>;
  usage?: Record<string, number>;
  entitlements?: Entitlements;
  loading: boolean;
  error: boolean;
  fetching: boolean;
  onRetry: () => unknown;
}) {
  const { t } = useTranslation("billing");
  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby={`${id}-usage`}
      className="min-w-0 scroll-mt-6 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-usage`} className="font-heading text-base font-semibold">
          {t("billing.screen.usage.title")}
        </h2>
        <Button
          variant="ghost"
          className={cn(ACTION, "h-7 text-muted-foreground")}
          disabled={loading || error || !usage || !entitlements}
          onClick={() =>
            exportToCsv(
              "billing-usage",
              BILLING_RESOURCES.map((resource) => ({
                resource,
                used: usage?.[resource],
                limit: entitlements?.limits[resource],
              })),
              // Column headers are part of the file format, so they stay English.
              [
                { header: "Resource", value: (row) => row.resource },
                { header: "Used", value: (row) => row.used },
                { header: "Limit (-1 = unlimited)", value: (row) => row.limit },
              ],
            )
          }
        >
          <ArrowDownToLineIcon aria-hidden="true" />
          {t("billing.screen.usage.export")}
        </Button>
      </div>
      <div
        className={cn(
          SURFACE,
          "grid divide-y divide-border/60 @min-[480px]/billing:grid-cols-2 @min-[880px]/billing:grid-cols-4 @min-[880px]/billing:divide-x @min-[880px]/billing:divide-y-0",
        )}
      >
        {BILLING_RESOURCES.map((resource) => {
          const meter = billingUsage(
            error ? undefined : usage?.[resource],
            error ? undefined : entitlements?.limits[resource],
          );
          const Icon = RESOURCE_ICONS[resource];
          const label = t(`billing.screen.usage.${resource}`);
          return (
            <article key={resource} className="min-w-0 px-4 py-3.5">
              <h3 className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                {label}
              </h3>
              {loading ? (
                <Skeleton className="my-2 h-8 w-2/3" />
              ) : (
                <p className="my-2 flex flex-wrap items-baseline gap-1.5">
                  <strong
                    className={cn(
                      "font-heading text-xl font-semibold tabular-nums",
                      meter.exceeded && "text-destructive",
                    )}
                  >
                    {meter.used === null
                      ? t("billing.screen.unavailable")
                      : meter.used.toLocaleString(formatLocale())}
                  </strong>
                  <span className="text-[11px] text-muted-foreground">
                    {meter.unlimited
                      ? t("billing.screen.usage.unlimited")
                      : meter.limit !== null
                        ? t("billing.screen.usage.limit", {
                            limit: meter.limit.toLocaleString(formatLocale()),
                          })
                        : ""}
                  </span>
                </p>
              )}
              <div
                role="progressbar"
                aria-hidden={meter.percent === null}
                aria-label={label}
                aria-valuemin={meter.percent !== null ? 0 : undefined}
                aria-valuemax={meter.percent !== null ? 100 : undefined}
                aria-valuenow={meter.percent ?? undefined}
                aria-valuetext={
                  meter.percent !== null
                    ? t("billing.screen.usage.count", {
                        used: meter.used,
                        limit: meter.limit,
                      })
                    : undefined
                }
                className="h-1 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={cn(
                    "h-full rounded-full",
                    meter.exceeded ? "bg-destructive" : "bg-primary",
                  )}
                  style={{ width: `${meter.percent ?? 0}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {loading
                  ? t("billing.screen.usage.loading")
                  : meter.used === null || meter.limit === null
                    ? t("billing.screen.usage.unavailable")
                    : meter.exceeded
                      ? t("billing.screen.usage.exceeded")
                      : meter.unlimited
                        ? t("billing.screen.usage.noCap")
                        : meter.limit === 0
                          ? t("billing.screen.usage.notIncluded")
                          : t("billing.screen.usage.percent", { percent: meter.percent })}
              </p>
            </article>
          );
        })}
      </div>
      {error && (
        <div className="mt-2 text-xs">
          <BillingErrorState
            label={t("billing.screen.usage.error")}
            fetching={fetching}
            onRetry={onRetry}
          />
        </div>
      )}
    </section>
  );
}
