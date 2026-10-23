// Presentation-only plan metadata the billing API doesn't carry (featured tier, contact sales).
// Names, prices and features come from GET /v1/billing/plans.

export const TIER_ORDER = ["free", "starter", "pro", "enterprise"] as const;
export type Tier = (typeof TIER_ORDER)[number];

export interface TierMeta {
  badge?: string;
  featured?: boolean;
  contactSales?: boolean; // no self-serve checkout: talk to sales instead
}

export const TIER_META: Record<Tier, TierMeta> = {
  free: {},
  starter: {},
  pro: { badge: "Most popular", featured: true },
  enterprise: { contactSales: true },
};

export const SALES_EMAIL = "sales@qeet.in";

/** The tier a plan code belongs to (strips the "_year" annual suffix). */
export function tierOfCode(code: string): Tier {
  return code.replace(/_year$/, "") as Tier;
}

/**
 * Default billing country per currency, so the server routes the payment to the right processor
 * (IN → Razorpay) without asking the user for a country up front.
 */
export const CURRENCY_COUNTRY: Record<string, string> = {
  USD: "US",
  EUR: "DE",
  GBP: "GB",
  INR: "IN",
  JPY: "JP",
  AUD: "AU",
  CAD: "CA",
};

/** Turns a name into a URL-safe org slug (lowercase, hyphenated, a–z0–9 only). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
