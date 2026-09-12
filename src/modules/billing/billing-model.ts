import {
  type BillingInterval,
  type BillingProfile,
  type Plan,
  planCodeForTier,
  type Subscription,
} from "./api/billing";

export const BILLING_RESOURCES = ["seats", "apps", "api_keys", "custom_roles"] as const;

export const BILLING_TIERS = ["free", "starter", "pro", "enterprise"] as const;
export const FREE_DOWNGRADE_LIMITS: Record<string, number> = {
  seats: 5,
  apps: 3,
  api_keys: 2,
  custom_roles: 0,
};

export const BILLING_COUNTRIES = [
  "IN",
  "US",
  "GB",
  "CA",
  "AU",
  "DE",
  "FR",
  "ES",
  "IT",
  "NL",
  "IE",
  "SE",
  "JP",
  "SG",
  "AE",
  "BR",
  "ZA",
] as const;

export const EMPTY_BILLING_PROFILE: BillingProfile = {
  legal_name: "",
  billing_email: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
  tax_id_type: "none",
  tax_id: "",
};

export type BillingPlanChoice = {
  tier: string;
  code: string;
  plan: Plan;
  amount: number | null;
  interval: BillingInterval;
  contactSales: boolean;
};

export function billingPlanChoices(plans: Plan[], interval: BillingInterval, currency: string) {
  return BILLING_TIERS.flatMap((tier): BillingPlanChoice[] => {
    const code = planCodeForTier(tier, interval);
    const priced = plans.find((plan) => plan.code === code);
    const plan = priced ?? plans.find((plan) => plan.code === tier);
    if (!plan) return [];
    const amount = priced?.prices?.[currency];
    return [
      {
        tier,
        code,
        plan,
        amount: amount !== undefined && Number.isSafeInteger(amount) && amount >= 0 ? amount : null,
        interval: tier === "free" || tier === "enterprise" ? "month" : interval,
        contactSales: tier === "enterprise",
      },
    ];
  });
}

export function billingCurrencies(plans: Plan[]): string[] {
  return [...new Set(plans.flatMap((plan) => Object.keys(plan.prices ?? {})))].sort();
}

export function billingSavings(plans: Plan[], currency: string): number {
  const monthly = plans.find((plan) => plan.code === "pro")?.prices?.[currency];
  const yearly = plans.find((plan) => plan.code === "pro_year")?.prices?.[currency];
  if (!monthly || monthly < 0 || yearly === undefined || yearly < 0) return 0;
  return Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100));
}

export function billingCurrencyLabel(currency: string): string {
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

export function checkoutCountry(currency: string, profile?: BillingProfile): string {
  const country = profile?.country.trim().toUpperCase();
  if (country && /^[A-Z]{2}$/.test(country)) return country;
  const defaults: Record<string, string> = {
    USD: "US",
    EUR: "DE",
    GBP: "GB",
    INR: "IN",
    JPY: "JP",
    AUD: "AU",
    CAD: "CA",
  };
  return defaults[currency] ?? "US";
}

export function isCurrentBillingChoice(
  choice: BillingPlanChoice,
  subscription: Subscription | undefined,
  currency: string,
  entitlementPlan?: string,
): boolean {
  if (!subscription || subscription.status === "trialing" || subscription.cancel_at_period_end) {
    return false;
  }
  if (subscription.status === "none") return choice.code === (entitlementPlan || "free");
  if (!["active", "past_due", "unpaid"].includes(subscription.status)) return false;
  return subscription.plan_code === choice.code && subscription.currency === currency;
}

export function normalizeBillingProfile(profile: BillingProfile): BillingProfile {
  return {
    ...Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, value.trim()])),
    country: profile.country.trim().toUpperCase(),
    tax_id_type: profile.tax_id_type,
    tax_id: profile.tax_id_type === "none" ? "" : profile.tax_id.trim().toUpperCase(),
  } as BillingProfile;
}

export function billingTaxIdValid(profile: BillingProfile): boolean {
  const value = profile.tax_id.trim().toUpperCase();
  if (profile.tax_id_type === "none") return true;
  return profile.tax_id_type === "gstin" ? /^[0-9A-Z]{15}$/.test(value) : value.length > 0;
}

export type BillingUsage = {
  used: number | null;
  limit: number | null;
  unlimited: boolean;
  percent: number | null;
  exceeded: boolean;
};

export function hasBillingUsage(usage?: Record<string, number>): boolean {
  return BILLING_RESOURCES.every((resource) => billingUsage(usage?.[resource]).used !== null);
}

export function billingUsage(used?: number, limit?: number): BillingUsage {
  const validUsage = Number.isSafeInteger(used) && used !== undefined && used >= 0;
  const validLimit = Number.isSafeInteger(limit) && limit !== undefined && limit >= -1;
  const usage = validUsage ? used : null;
  const cap = validLimit ? limit : null;
  const unlimited = cap === -1;

  return {
    used: usage,
    limit: cap,
    unlimited,
    percent:
      usage === null || cap === null || unlimited
        ? null
        : cap === 0
          ? Number(usage > 0) * 100
          : Math.min(100, Math.round((usage / cap) * 100)),
    exceeded: usage !== null && cap !== null && cap >= 0 && usage > cap,
  };
}
