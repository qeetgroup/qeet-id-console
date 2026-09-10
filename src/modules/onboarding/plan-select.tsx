import { Box, Buildings, Crown, People, RefreshArrow, TickCircle } from "@qeetrix/icons";
import {
  Button,
  cn,
  DataState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@qeetrix/ui";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ContactSalesDialog } from "@/modules/billing";
import {
  type BillingInterval,
  formatMoney,
  type Plan,
  planCodeForTier,
  usePlans,
} from "@/modules/billing";

import { CURRENCY_COUNTRY, type Tier, TIER_META, TIER_ORDER } from "./plan-catalog";
import {
  SETUP_FOCUS,
  SETUP_PANEL,
  SETUP_PRIMARY,
  SETUP_SECONDARY,
  SETUP_THEME,
} from "./setup-styles";

const PLAN_ICONS = { free: Box, starter: People, pro: Crown, enterprise: Buildings };

function currencyLabel(currency: string) {
  try {
    const symbol = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value;
    return symbol ? `${currency} (${symbol})` : currency;
  } catch {
    return currency;
  }
}

export interface PlanSelection {
  tier: Tier;
  planCode: string;
  interval: BillingInterval;
  currency: string;
  country: string;
}

interface PlanSelectProps {
  /** Called when a plan card's CTA is clicked. */
  onSelect: (sel: PlanSelection) => void;
  /** Tier currently being processed — shows a spinner and disables its CTA. */
  busyTier?: Tier | null;
  /** CTA label per tier; defaults to a sensible verb. */
  ctaLabel?: (tier: Tier) => string;
  /** When set, the matching tier is marked as the current plan and disabled. */
  currentTier?: Tier | null;
  /** Force a single-column card layout (for narrow containers like a sheet). */
  stacked?: boolean;
  /** Restore the billing choice when returning from a later setup step. */
  initialSelection?: PlanSelection | null;
  className?: string;
}

/**
 * Presentational plan picker: four tier cards with a Monthly/Yearly toggle and
 * a currency selector, driven by the live billing catalog. Reused by first-run
 * onboarding and the create-organization flow. Selecting a card hands the full
 * selection (tier, resolved plan code, interval, currency, country) to the
 * parent — this component takes no payment itself.
 */
export function PlanSelect({
  onSelect,
  busyTier,
  ctaLabel,
  currentTier,
  stacked,
  initialSelection,
  className,
}: PlanSelectProps) {
  const { t } = useTranslation("dashboard");
  const id = useId();
  const plansQ = usePlans();
  const plans = useMemo(() => plansQ.data?.items ?? [], [plansQ.data]);

  const byCode = useMemo(() => {
    const m = new Map<string, Plan>();
    for (const p of plans) m.set(p.code, p);
    return m;
  }, [plans]);

  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const p of plans) for (const c of Object.keys(p.prices)) set.add(c);
    return [...set].sort();
  }, [plans]);

  const [interval, setInterval] = useState<BillingInterval>(initialSelection?.interval ?? "month");
  const [currency, setCurrency] = useState<string | null>(initialSelection?.currency ?? null);
  const [salesOpen, setSalesOpen] = useState(false);
  const activeCurrency =
    currency && currencies.includes(currency)
      ? currency
      : ((currencies.includes("INR")
          ? "INR"
          : currencies.includes("USD")
            ? "USD"
            : currencies[0]) ?? "USD");
  const country = CURRENCY_COUNTRY[activeCurrency] ?? "US";

  // Best-case annual saving across the paid tiers, for the toggle hint.
  const yearlySavingPct = useMemo(() => {
    let best = 0;
    for (const tier of ["starter", "pro"] as const) {
      const m = byCode.get(tier)?.prices?.[activeCurrency];
      const y = byCode.get(`${tier}_year`)?.prices?.[activeCurrency];
      if (m && y && m > 0) best = Math.max(best, Math.round((1 - y / (m * 12)) * 100));
    }
    return best;
  }, [byCode, activeCurrency]);

  const gridClass = stacked
    ? "grid grid-cols-1 gap-3"
    : "grid grid-cols-1 gap-3 @min-[460px]/plans:grid-cols-2 @min-[850px]/plans:grid-cols-4";

  return (
    <div className={cn(SETUP_THEME, "@container/plans flex min-w-0 flex-col gap-2.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Self-contained segmented toggle: the active background is driven
            directly by state so it always tracks the selection. */}
        <fieldset
          aria-label={t("setup.plans.billingCycle")}
          className="inline-flex h-7 items-center gap-0.5 rounded-xl border border-(--setup-border)/60 bg-(--setup-border)/45 p-0.5 text-[11px] text-(--setup-muted) dark:bg-(--setup-soft)/80 pointer-coarse:min-h-11"
        >
          {(["month", "year"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={interval === v}
              disabled={!!busyTier || plansQ.isLoading}
              onClick={() => setInterval(v)}
              className={cn(
                "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-lg px-3 font-medium transition-colors",
                SETUP_FOCUS,
                interval === v
                  ? "bg-(--setup-surface) text-(--setup-text) shadow-sm ring-1 ring-black/3 dark:bg-linear-135 dark:from-orange-500/30 dark:to-orange-950/50 dark:text-orange-100 dark:ring-orange-500/75"
                  : "hover:text-(--setup-text)",
              )}
            >
              {t(`setup.plans.${v}`)}
              {v === "year" && yearlySavingPct > 0 && (
                <span className="text-[10px] font-normal dark:rounded-full dark:border dark:border-orange-400/20 dark:bg-orange-950/30 dark:px-2 dark:py-0.5 dark:text-orange-200">
                  {t("setup.plans.saving", { percent: yearlySavingPct })}
                </span>
              )}
            </button>
          ))}
        </fieldset>

        {currencies.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor={`${id}-currency`} className="text-[11px] text-(--setup-muted)">
              {t("setup.plans.currency")}
            </label>
            <Select
              value={activeCurrency}
              onValueChange={(v) => v && setCurrency(v)}
              disabled={!!busyTier}
            >
              <SelectTrigger
                id={`${id}-currency`}
                className="h-7 w-28 rounded-lg border-(--setup-border) bg-(--setup-soft)/60 text-[11px] pointer-coarse:min-h-11"
                size="sm"
              >
                <SelectValue>{currencyLabel(activeCurrency)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {currencyLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <DataState
        isLoading={plansQ.isLoading}
        isError={plansQ.isError}
        isEmpty={!plansQ.isLoading && plans.length === 0}
        emptyTitle={t("setup.plans.empty")}
        loading={
          <div className={gridClass} role="status" aria-label={t("setup.plans.loading")}>
            {TIER_ORDER.map((tier) => (
              <Skeleton key={tier} className="h-80 rounded-xl" />
            ))}
          </div>
        }
        errorFallback={
          <div className={cn(SETUP_PANEL, "p-8 text-center")} role="alert">
            <p className="text-sm">{t("setup.plans.error")}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => plansQ.refetch()}
            >
              <RefreshArrow aria-hidden="true" /> {t("setup.plans.retry")}
            </Button>
          </div>
        }
      >
        <div className={gridClass}>
          {TIER_ORDER.map((tier) => {
            const meta = TIER_META[tier];
            const Icon = PLAN_ICONS[tier];
            const planCode = planCodeForTier(tier, interval);
            const pricedPlan = byCode.get(planCode);
            // Keep feature copy visible when a price is unavailable, but never
            // divide a monthly price by 12 or submit an unpriced annual code.
            const plan = pricedPlan ?? byCode.get(tier);
            if (!plan) return null;

            const priceMinor = pricedPlan?.prices[activeCurrency];
            const unavailable = !meta.contactSales && priceMinor === undefined;
            const isFree = tier === "free" || priceMinor === 0;
            const isYear = interval === "year" && !meta.contactSales && !isFree;
            const isCurrent = currentTier === tier;
            const busy = busyTier === tier;

            const monthlyEquivMinor =
              isYear && priceMinor !== undefined ? Math.round(priceMinor / 12) : undefined;

            const label = ctaLabel
              ? ctaLabel(tier)
              : meta.contactSales
                ? t("setup.plans.contactSales")
                : isFree
                  ? t("setup.plans.chooseFree")
                  : t("setup.plans.choose");

            return (
              <article
                key={tier}
                data-tier={tier}
                aria-labelledby={`${id}-${tier}`}
                className={cn(
                  SETUP_PANEL,
                  "relative isolate flex min-w-0 flex-col gap-2.5 p-3.5 transition-shadow motion-reduce:transition-none",
                  !stacked && "@min-[850px]/plans:min-h-79 dark:@min-[850px]/plans:min-h-84",
                  meta.featured &&
                    "border-[#f57c30] bg-orange-50/15 dark:border-[#ef791f] dark:bg-(--setup-surface) dark:shadow-[0_0_0_1px_rgb(239_121_31/0.25),0_0_18px_rgb(239_100_17/0.12),inset_0_1px_14px_rgb(230_103_20/0.05)]",
                  isCurrent && "ring-2 ring-(--setup-accent)/30",
                )}
              >
                <div className="relative flex min-h-10 flex-wrap items-start gap-x-2.5 gap-y-1.5 dark:min-h-8">
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-lg bg-(--setup-soft) text-(--setup-text) dark:order-2 dark:ms-auto",
                      meta.featured &&
                        "bg-transparent text-(--setup-accent) dark:absolute dark:top-6 dark:right-0",
                    )}
                  >
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 dark:order-0">
                    <h2 id={`${id}-${tier}`} className="font-sans text-sm font-semibold leading-5">
                      {plan.name}
                    </h2>
                    <p className="mt-0.5 text-[10px] leading-4 text-(--setup-muted) dark:hidden">
                      {plan.description}
                    </p>
                  </div>
                  <div className="absolute -top-1 -right-0.5 flex flex-col items-end gap-1">
                    {meta.badge && (
                      <span className="rounded-full bg-[#cc4500] px-2 py-0.75 text-[9px] text-white dark:rounded-lg dark:border dark:border-orange-500/75 dark:bg-orange-950/65 dark:text-orange-100 dark:shadow-[0_0_8px_rgb(237_110_22/0.18)]">
                        {t("setup.plans.popular")}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="rounded-full border border-(--setup-accent)/40 bg-(--setup-surface) px-2 py-0.5 text-[10px] text-(--setup-accent)">
                        {t("setup.plans.current")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="min-h-11 dark:min-h-13">
                  <div className="flex flex-wrap items-baseline gap-1">
                    <span
                      className={cn(
                        "font-sans text-[26px] font-bold leading-8 tracking-[-0.045em] tabular-nums",
                        meta.featured && "text-(--setup-accent) dark:text-(--setup-text)",
                      )}
                    >
                      {meta.contactSales
                        ? t("setup.plans.custom")
                        : priceMinor === undefined
                          ? "—"
                          : formatMoney(priceMinor, activeCurrency)}
                    </span>
                    {!meta.contactSales && priceMinor !== undefined && !isFree && (
                      <span className="text-[10px] text-(--setup-muted)">
                        {t(isYear ? "setup.plans.perYear" : "setup.plans.perMonth")}
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-1 text-[10px] leading-4 text-(--setup-muted)",
                      !meta.contactSales && !isYear && !unavailable && "hidden dark:block",
                    )}
                  >
                    {unavailable
                      ? t("setup.plans.unavailable")
                      : meta.contactSales
                        ? t("setup.plans.annualContract")
                        : isYear && monthlyEquivMinor !== undefined
                          ? t("setup.plans.yearlyEquivalent", {
                              amount: formatMoney(monthlyEquivMinor, activeCurrency),
                            })
                          : plan.description}
                  </p>
                </div>

                <ul className="m-0 flex flex-1 list-none flex-col gap-1.5 p-0 text-[10.5px] leading-[1.45] dark:gap-2 dark:text-[11px]">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-0.5 shrink-0 text-(--setup-muted)",
                          meta.featured && "dark:text-(--setup-accent)",
                        )}
                      >
                        <TickCircle className="size-3" aria-hidden="true" />
                      </span>
                      <span className="text-(--setup-muted)">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  type="button"
                  variant={meta.featured ? "default" : "outline"}
                  className={cn(
                    meta.featured ? SETUP_PRIMARY : SETUP_SECONDARY,
                    "mt-auto h-7.5 w-full rounded-md px-2 text-[11px]",
                    SETUP_FOCUS,
                  )}
                  disabled={isCurrent || unavailable || !!busyTier}
                  onClick={() =>
                    // Enterprise is contact-sales, not self-serve: the server
                    // won't provision a paid/enterprise org via POST /v1/tenants.
                    tier === "enterprise"
                      ? setSalesOpen(true)
                      : onSelect({
                          tier,
                          planCode,
                          interval,
                          currency: activeCurrency,
                          country,
                        })
                  }
                >
                  {busy && (
                    <RefreshArrow
                      className="animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  )}
                  {isCurrent
                    ? t("setup.plans.currentPlan")
                    : unavailable
                      ? t("setup.plans.unavailable")
                      : label}
                </Button>
              </article>
            );
          })}
        </div>
      </DataState>
      <ContactSalesDialog open={salesOpen} onOpenChange={setSalesOpen} source="onboarding" />
    </div>
  );
}
