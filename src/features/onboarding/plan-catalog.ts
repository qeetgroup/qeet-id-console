// Display metadata for the plan tiers. Names, descriptions, feature lists, and
// prices all come from the billing API (GET /v1/billing/plans) so the catalog
// stays in sync with the backend; this file only adds presentation-layer
// decoration the API doesn't carry (which tier is featured, contact-sales, …).

export const TIER_ORDER = ["free", "starter", "pro", "enterprise"] as const;
export type Tier = (typeof TIER_ORDER)[number];

export interface TierMeta {
  badge?: string;
  featured?: boolean;
  /** Enterprise: no self-serve checkout — talk to sales instead. */
  contactSales?: boolean;
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

// Default billing country for a currency, so provider routing
// (backend PAYMENT_COUNTRY_ROUTES, e.g. IN → Razorpay) picks the right
// processor without making the user choose a country up front.
export const CURRENCY_COUNTRY: Record<string, string> = {
  USD: "US",
  EUR: "DE",
  GBP: "GB",
  INR: "IN",
  JPY: "JP",
  AUD: "AU",
  CAD: "CA",
};

/** Turn a name into a URL-safe org slug (lowercase, hyphenated, a–z0–9 only). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
