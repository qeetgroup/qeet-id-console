import type { BillingProfile, Entitlements, Subscription } from "./api/billing";
import { type PlanOffer, type Tier, tierOfCode } from "./plan-offers";

/** The plan-limited resources the server counts (GET …/entitlements/usage). */
export const BILLING_RESOURCES = ["seats", "apps", "api_keys", "custom_roles"] as const;
export type BillingResource = (typeof BILLING_RESOURCES)[number];

// Free's caps, as the server's entitlements catalogue sets them, to warn before a downgrade.
export const FREE_DOWNGRADE_LIMITS: Record<BillingResource, number> = {
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

/** The subscription's state as the page words it, from what the server returns and the clock. */
export type PlanState =
  | "free" // on Free
  | "active" // a paid plan, paid for up to current_period_end
  | "ending" // cancelled: marked to end with the period
  | "trial" // a no-card trial that hasn't ended
  | "trialEnded" // a trial past its end: the server treats the organisation as Free
  | "none" // no subscription on record
  | "other"; // past_due, unpaid, canceled or an unknown status

export function planState(subscription: Subscription | undefined, now = Date.now()): PlanState {
  if (!subscription) return "other";
  if (subscription.status === "none") return "none";
  if (subscription.status === "trialing") {
    const end = subscription.trial_end ? Date.parse(subscription.trial_end) : Number.NaN;
    return Number.isFinite(end) && end <= now ? "trialEnded" : "trial";
  }
  if (subscription.status !== "active") return "other";
  if (tierOfCode(subscription.plan_code) === "free") return "free";
  return subscription.cancel_at_period_end ? "ending" : "active";
}

/** The tier the organisation is on today: its subscription's, else its plan label's, else Free. */
export function currentTier(subscription?: Subscription, entitlements?: Entitlements): Tier {
  if (!subscription || subscription.status === "none") return tierOfCode(entitlements?.plan);
  if (planState(subscription) === "trialEnded") return "free";
  return tierOfCode(subscription.plan_code);
}

/**
 * Whether choosing this offer would change nothing: the same plan code, in the same currency, on
 * a subscription that is active and not ending. A trial, an ending plan or another cycle can be
 * chosen again.
 */
export function isCurrentOffer(
  offer: PlanOffer,
  subscription: Subscription | undefined,
  currency: string,
  entitlementPlan?: string,
): boolean {
  if (!subscription) return false;
  if (subscription.status === "none") return offer.planCode === (entitlementPlan || "free");
  const state = planState(subscription);
  if (state !== "active" && state !== "free") return false;
  return subscription.plan_code === offer.planCode && subscription.currency === currency;
}

/** The resources over Free's caps, with their counts, for the downgrade warning. */
export function overFreeLimits(usage?: Record<string, number>) {
  return BILLING_RESOURCES.flatMap((resource) => {
    const used = usage?.[resource] ?? 0;
    const limit = FREE_DOWNGRADE_LIMITS[resource];
    return used > limit ? [{ resource, used, limit }] : [];
  });
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

/** Whether a profile has anything saved (the server returns an empty one until the first save). */
export function hasBillingProfile(profile?: BillingProfile): boolean {
  return (
    !!profile && Object.entries(profile).some(([key, value]) => key !== "tax_id_type" && !!value)
  );
}

export type BillingUsage = {
  used: number | null;
  limit: number | null;
  unlimited: boolean;
  percent: number | null;
  exceeded: boolean;
  atLimit: boolean;
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
    atLimit: usage !== null && cap !== null && cap > 0 && usage === cap,
  };
}
