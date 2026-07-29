import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  DataState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qeetrix/ui";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import {
  type BillingInterval,
  formatMoney,
  type Plan,
  planCodeForTier,
  usePlans,
} from "@/lib/billing";

import {
  CURRENCY_COUNTRY,
  SALES_EMAIL,
  type Tier,
  TIER_META,
  TIER_ORDER,
} from "./plan-catalog";

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
  className,
}: PlanSelectProps) {
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

  const [interval, setInterval] = useState<BillingInterval>("month");
  const [currency, setCurrency] = useState<string | null>(null);
  const activeCurrency =
    currency ?? (currencies.includes("INR") ? "INR" : currencies.includes("USD") ? "USD" : currencies[0]) ?? "USD";
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

  return (
    <div className={cn("flex min-w-0 flex-col gap-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Self-contained segmented toggle: the active background is driven
            directly by state so it always tracks the selection. */}
        <div className="inline-flex h-8 items-center rounded-lg bg-muted p-1 text-xs text-muted-foreground">
          {(["month", "year"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={interval === v}
              onClick={() => setInterval(v)}
              className={cn(
                "inline-flex h-full items-center rounded-md px-3 font-medium transition-colors",
                interval === v
                  ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/5"
                  : "hover:text-foreground",
              )}
            >
              {v === "month"
                ? "Monthly"
                : `Yearly${yearlySavingPct > 0 ? ` · save ${yearlySavingPct}%` : ""}`}
            </button>
          ))}
        </div>

        {currencies.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Currency</span>
            <Select value={activeCurrency} onValueChange={(v) => v && setCurrency(v)}>
              <SelectTrigger className="w-24" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
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
        error={plansQ.error}
        isEmpty={!plansQ.isLoading && plans.length === 0}
        emptyTitle="No plans are available right now."
        skeletonRows={2}
      >
        <div
          className={cn(
            "grid gap-4",
            stacked ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
          )}
        >
          {TIER_ORDER.map((tier) => {
            const meta = TIER_META[tier];
            const planCode = planCodeForTier(tier, interval);
            // The annual variant carries the same name/description/features; fall
            // back to the base plan for tiers without a "_year" row (free/enterprise).
            const plan = byCode.get(planCode) ?? byCode.get(tier);
            if (!plan) return null;

            const priceMinor = plan.prices[activeCurrency];
            const isFree = tier === "free" || priceMinor === 0;
            const isYear = interval === "year" && !meta.contactSales && !isFree;
            const isCurrent = currentTier === tier;
            const busy = busyTier === tier;

            const monthlyEquivMinor =
              isYear && priceMinor !== undefined ? Math.round(priceMinor / 12) : undefined;

            const label = ctaLabel
              ? ctaLabel(tier)
              : meta.contactSales
                ? "Contact sales"
                : isFree
                  ? "Get started"
                  : "Continue";

            return (
              <Card
                key={tier}
                className={cn(
                  "relative flex flex-col overflow-hidden transition-shadow",
                  meta.featured ? "border-primary shadow-lg shadow-primary/10" : "border-border/60",
                  isCurrent && "ring-2 ring-primary/30",
                )}
              >
                {meta.featured && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-primary/60 via-primary to-primary/60"
                  />
                )}

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold">{plan.name}</CardTitle>
                    <div className="flex flex-col items-end gap-1">
                      {meta.badge && (
                        <Badge variant={meta.featured ? "default" : "secondary"} className="text-[10px]">
                          {meta.badge}
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge variant="outline" className="border-primary/40 text-[10px] text-primary">
                          Current
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="pt-3">
                    <div className="flex items-baseline gap-1">
                      <span
                        className={cn(
                          "font-display text-3xl font-bold tracking-tight",
                          meta.featured && "text-primary",
                        )}
                      >
                        {meta.contactSales
                          ? "Custom"
                          : priceMinor === undefined
                            ? "—"
                            : formatMoney(priceMinor, activeCurrency)}
                      </span>
                      {!meta.contactSales && priceMinor !== undefined && !isFree && (
                        <span className="text-xs text-muted-foreground">
                          {isYear ? "/ year" : "/ month"}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 min-h-4 text-xs text-muted-foreground">
                      {meta.contactSales
                        ? "Annual contract"
                        : isYear && monthlyEquivMinor !== undefined
                          ? `≈ ${formatMoney(monthlyEquivMinor, activeCurrency)} / month, billed yearly`
                          : plan.description}
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-5">
                  <ul className="flex flex-1 flex-col gap-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto flex flex-col gap-2">
                    <Button
                      variant={meta.featured ? "default" : "outline"}
                      className="w-full"
                      disabled={isCurrent || busy || !!busyTier}
                      onClick={() =>
                        onSelect({ tier, planCode, interval, currency: activeCurrency, country })
                      }
                    >
                      {busy && <Loader2Icon className="animate-spin" />}
                      {isCurrent ? "Current plan" : label}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DataState>
    </div>
  );
}
