// Internal billing data layer. Money arrives as integer minor units + an ISO
// currency code; formatMoney applies the currency's own fraction digits via
// Intl, so every currency (JPY 0-digit, BHD 3-digit, USD 2-digit, …) renders
// correctly.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";
import { useTenantId } from "./auth";

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string;
  interval: string;
  features: string[];
  prices: Record<string, number>;
}

export interface Subscription {
  plan_code: string;
  plan_name: string;
  currency: string;
  amount_minor: number;
  interval: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface Invoice {
  id: string;
  plan_code: string;
  currency: string;
  amount_minor: number;
  status: string;
  period_start: string;
  period_end: string;
  issued_at: string;
}

/**
 * Entitlements is the tenant's resolved plan capability set — the source of
 * truth for UI gating (mirrors the server's operations/entitlements catalog).
 * `features` are booleans (locked → Upgrade); `limits` are numeric caps where
 * -1 means unlimited.
 */
export interface Entitlements {
  plan: string;
  features: Record<string, boolean>;
  limits: Record<string, number>;
}

export function useEntitlements() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["billing", "entitlements", tenantId],
    enabled: !!tenantId,
    queryFn: () => api<Entitlements>(`/v1/tenants/${tenantId}/entitlements`),
  });
}

/** Format integer minor units in the given ISO currency, for any currency. */
export function formatMoney(amountMinor: number, currency: string): string {
  try {
    const fmt = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    });
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
    return fmt.format(amountMinor / 10 ** digits);
  } catch {
    // Unknown/invalid currency code — fall back to a plain number + code.
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

export function usePlans() {
  return useQuery({
    queryKey: ["billing", "plans"],
    queryFn: () => api<{ items: Plan[] }>("/v1/billing/plans"),
  });
}

export function useSubscription() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["billing", "subscription", tenantId],
    enabled: !!tenantId,
    queryFn: () => api<Subscription>(`/v1/tenants/${tenantId}/billing/subscription`),
  });
}

export function useInvoices() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["billing", "invoices", tenantId],
    enabled: !!tenantId,
    queryFn: () => api<{ items: Invoice[] }>(`/v1/tenants/${tenantId}/billing/invoices`),
  });
}

export function useChangePlan() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { plan_code: string; currency: string }) =>
      api<Subscription>(`/v1/tenants/${tenantId}/billing/subscription`, {
        method: "PUT",
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing"] }),
    meta: { successMessage: "Subscription updated" },
  });
}

export interface CheckoutResult {
  status: "active" | "checkout";
  checkout_url?: string;
  provider?: string;
}

/**
 * Start a paid plan change. The backend either activates the plan directly
 * (free plan / no card provider for the currency) or returns a hosted-checkout
 * URL (Stripe/Razorpay) to redirect to. success_url / cancel_url are this app's
 * own billing page so the provider returns the admin here after paying.
 */
export function useCheckout() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      plan_code: string;
      currency: string;
      country?: string;
    }): Promise<CheckoutResult> => {
      const base = `${window.location.origin}/settings/billing`;
      return api<CheckoutResult>(`/v1/tenants/${tenantId}/billing/checkout`, {
        method: "POST",
        body: {
          ...body,
          success_url: `${base}?checkout=success`,
          cancel_url: `${base}?checkout=cancelled`,
        },
      });
    },
    onSuccess: (res) => {
      if (res.status === "checkout" && res.checkout_url) {
        window.location.href = res.checkout_url; // redirect to provider
        return;
      }
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
    meta: { successMessage: "Subscription updated" },
  });
}

export function useCancelSubscription() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ cancel_at_period_end: boolean }>(
        `/v1/tenants/${tenantId}/billing/subscription/cancel`,
        { method: "POST" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing"] }),
    meta: { successMessage: "Subscription will cancel at period end" },
  });
}

// ---------------------------------------------------------------------------
// Signup / create-organization checkout
// ---------------------------------------------------------------------------

export type BillingInterval = "month" | "year";

/**
 * The plan code for a tier at a billing interval. Free and Enterprise have no
 * annual variant (Free is free; Enterprise is contact-sales), so they always
 * map to the base code; the paid tiers get a "<tier>_year" code.
 */
export function planCodeForTier(tier: string, interval: BillingInterval): string {
  return interval === "year" && tier !== "free" && tier !== "enterprise" ? `${tier}_year` : tier;
}

/**
 * Start a paid checkout for a plan chosen during signup, BEFORE any org exists.
 * The org spec rides along and the organization is created only when the payment
 * completes — so an abandoned payment never leaves a dangling org. Returns a
 * hosted-checkout URL (Razorpay / dev sandbox) to redirect the payer to.
 */
export function startSignupCheckout(input: {
  orgName: string;
  orgSlug: string;
  region: string;
  planCode: string;
  currency: string;
  country?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutResult> {
  return api<CheckoutResult>("/v1/signup/checkout", {
    method: "POST",
    body: {
      org_name: input.orgName,
      org_slug: input.orgSlug,
      region: input.region,
      plan_code: input.planCode,
      currency: input.currency,
      country: input.country,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    },
  });
}
