// What each plan costs in a currency and billing cycle, from the live catalogue
// (GET /v1/billing/plans), including what paying yearly saves. Pure, so the sums are tested alone.
//
// A copy of src/modules/onboarding/plan-pricing.ts and the tier part of plan-catalog.ts, so
// Billing › Change plan prices plans exactly as Create organisation does. The onboarding barrel
// doesn't export them yet; once it does, this file goes and billing imports them from there
// (MIGRATION-NOTES-billing-branding.md).

import { formatLocale } from "@/i18n";

import { type BillingInterval, type Plan, planCodeForTier } from "./api/billing";

export const TIER_ORDER = ["free", "starter", "pro", "enterprise"] as const;
export type Tier = (typeof TIER_ORDER)[number];

/** Presentation-only plan metadata the billing API doesn't carry. */
export const TIER_META: Record<Tier, { popular?: boolean; contactSales?: boolean }> = {
  free: {},
  starter: {},
  pro: { popular: true },
  enterprise: { contactSales: true },
};

/** The tier a plan code belongs to (strips the "_year" annual suffix); unknown codes are Free. */
export function tierOfCode(code: string | undefined): Tier {
  const tier = (code ?? "").replace(/_year$/, "");
  return (TIER_ORDER as readonly string[]).includes(tier) ? (tier as Tier) : "free";
}

/** A plan as the picker shows it, for one currency and billing cycle. */
export interface PlanOffer {
  tier: Tier;
  name: string;
  description: string;
  features: string[];
  planCode: string; // what checkout charges
  price?: number; // minor units for the cycle; absent for Enterprise and where it isn't offered
  contactSales: boolean;
  unavailable: boolean; // a self-serve plan with no price in this currency and cycle
  /** Billed yearly: the same twelve months at the monthly price, and what yearly saves. */
  yearly?: { monthly: number; twelveMonths: number; saving: number; percent: number };
  /** Billed monthly: what the yearly plan would cost instead, and save. */
  yearlyAlternative?: { price: number; saving: number };
}

/** The currencies the catalogue prices in, sorted. */
export function planCurrencies(plans: readonly Plan[]): string[] {
  return [...new Set(plans.flatMap((plan) => Object.keys(plan.prices ?? {})))].sort();
}

/** INR first (India-first), then USD, then whatever the catalogue has. */
export function defaultCurrency(currencies: readonly string[]): string {
  if (currencies.includes("INR")) return "INR";
  if (currencies.includes("USD")) return "USD";
  return currencies[0] ?? "USD";
}

function fractionDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** Rounds minor units to a whole amount of the currency: ₹6,666.67 a month becomes ₹6,667. */
export function roundToWhole(minor: number, currency: string): number {
  const unit = 10 ** fractionDigits(currency);
  return Math.round(minor / unit) * unit;
}

/** A price with its symbol, without ".00" when it's a whole amount: ₹2,400, $29, ¥4,500. */
export function formatPrice(minor: number, currency: string): string {
  const digits = fractionDigits(currency);
  const amount = minor / 10 ** digits;
  const whole = Number.isInteger(amount);
  try {
    return new Intl.NumberFormat(formatLocale(), {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: whole ? 0 : digits,
      maximumFractionDigits: whole ? 0 : digits,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** "INR (₹)", for the currency picker. */
export function currencyLabel(currency: string): string {
  try {
    const symbol = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value;
    return symbol && symbol !== currency ? `${currency} (${symbol})` : currency;
  } catch {
    return currency;
  }
}

/** The best yearly saving across the self-serve plans, in whole percent, for the cycle toggle. */
export function bestYearlySaving(plans: readonly Plan[], currency: string): number {
  return Math.max(
    0,
    ...planOffers(plans, "year", currency).map((offer) => offer.yearly?.percent ?? 0),
  );
}

/** The four plans in order, priced for a currency and cycle; a plan missing from the catalogue is left out. */
export function planOffers(
  plans: readonly Plan[],
  interval: BillingInterval,
  currency: string,
): PlanOffer[] {
  const byCode = new Map(plans.map((plan) => [plan.code, plan]));
  return TIER_ORDER.flatMap((tier): PlanOffer[] => {
    const meta = TIER_META[tier];
    const planCode = planCodeForTier(tier, interval);
    const priced = byCode.get(planCode);
    // Without an annual plan the copy still shows, but the price stays unknown: never a monthly
    // price shown as a yearly one, and never an unpriced annual code sent to checkout.
    const plan = priced ?? byCode.get(tier);
    if (!plan) return [];
    const price = meta.contactSales ? undefined : priced?.prices?.[currency];
    const monthly = byCode.get(tier)?.prices?.[currency];
    const annual = byCode.get(planCodeForTier(tier, "year"));
    const annualPrice = annual && annual.code !== tier ? annual.prices?.[currency] : undefined;

    const offer: PlanOffer = {
      tier,
      name: plan.name,
      description: byCode.get(tier)?.description ?? plan.description,
      features: plan.features,
      planCode,
      price,
      contactSales: !!meta.contactSales,
      unavailable: !meta.contactSales && price === undefined,
    };
    if (meta.contactSales || !monthly || annualPrice === undefined) return [offer];

    const twelveMonths = monthly * 12;
    const saving = twelveMonths - annualPrice;
    if (saving <= 0) return [offer];
    if (interval === "year") {
      offer.yearly = {
        monthly: roundToWhole(annualPrice / 12, currency),
        twelveMonths,
        saving,
        percent: Math.round((saving / twelveMonths) * 100),
      };
    } else {
      offer.yearlyAlternative = { price: annualPrice, saving };
    }
    return [offer];
  });
}
