import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { formatLocale, humanizeMissingKey } from "@/i18n";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { billingKeys } from "./keys";

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
  trial_end: string | null;
}

export interface Invoice {
  id: string;
  plan_code: string;
  currency: string;
  amount_minor: number; // total charged: taxable amount plus tax
  taxable_amount_minor: number;
  tax_amount_minor: number;
  tax_rate_bps: number;
  tax_type: string; // none | gst_cgst_sgst | gst_igst | gst_zero_rated | vat_reverse_charge
  place_of_supply: string;
  status: string;
  period_start: string;
  period_end: string;
  issued_at: string;
}

/**
 * The tenant's resolved plan capabilities, which drive UI gating. A false `features` entry shows
 * an Upgrade prompt; `limits` are numeric caps where -1 means unlimited.
 */
export interface Entitlements {
  plan: string;
  features: Record<string, boolean>;
  limits: Record<string, number>;
}

export function useEntitlements(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: billingKeys.entitlements(tenantId),
    enabled: !!tenantId && enabled,
    queryFn: () => api<Entitlements>(`/v1/tenants/${tenantId}/entitlements`),
  });
}

/**
 * Fetches current usage per resource (seats, apps, API keys, custom roles). Kept apart from
 * useEntitlements so the counts run only where usage is shown, not on every gated page.
 */
export function useUsage(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: billingKeys.usage(tenantId),
    enabled: !!tenantId && enabled,
    queryFn: () =>
      api<{ usage: Record<string, number> }>(`/v1/tenants/${tenantId}/entitlements/usage`),
  });
}

/** A tenant's billing & tax details, carried onto invoices. */
export interface BillingProfile {
  legal_name: string;
  billing_email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  tax_id_type: "none" | "gstin" | "vat";
  tax_id: string;
}

/** Starts a no-card trial of a paid tier; only an org with no subscription yet is eligible. */
export function useStartTrial() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { plan_code: string; currency: string }) =>
      api<Subscription>(`/v1/tenants/${tenantId}/billing/trial`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.tenant(tenantId) }),
    meta: { successMessage: "billing:toast.trialStarted", silentError: true },
  });
}

export function useBillingProfile(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: billingKeys.profile(tenantId),
    enabled: !!tenantId && enabled,
    queryFn: () => api<BillingProfile>(`/v1/tenants/${tenantId}/billing/profile`),
  });
}

export function useSaveBillingProfile() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BillingProfile) =>
      api<BillingProfile>(`/v1/tenants/${tenantId}/billing/profile`, { method: "PUT", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.profile(tenantId) }),
    meta: { successMessage: "billing:toast.billingProfileSaved", silentError: true },
  });
}

/**
 * Formats integer minor units in an ISO currency with its own fraction digits (JPY 0, USD 2,
 * BHD 3). An unknown code falls back to two decimals followed by the code.
 */
export function formatMoney(amountMinor: number, currency: string): string {
  try {
    const fmt = new Intl.NumberFormat(formatLocale(), {
      style: "currency",
      currency,
    });
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
    return fmt.format(amountMinor / 10 ** digits);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

const plansQuery = queryOptions({
  queryKey: billingKeys.plans(),
  queryFn: () => api<{ items: Plan[] }>("/v1/billing/plans"),
});

export function usePlans() {
  return useQuery(plansQuery);
}

/**
 * Returns a function that names a plan code from the plan catalogue. A code the catalogue doesn't
 * hold, or any code before it loads, reads as words ("pro_year" is "Pro Year"), never raw.
 */
export function usePlanName(): (code: string) => string {
  // The catalogue rarely changes, and a failed load only costs the display name, so it is quiet.
  const plans = useQuery({ ...plansQuery, staleTime: 5 * 60_000, meta: { silent: true } });
  return (code) =>
    plans.data?.items.find((plan) => plan.code === code)?.name || humanizeMissingKey(code);
}

export function useSubscription(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: billingKeys.subscription(tenantId),
    enabled: !!tenantId && enabled,
    queryFn: () => api<Subscription>(`/v1/tenants/${tenantId}/billing/subscription`),
  });
}

export function useInvoices(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: billingKeys.invoices(tenantId),
    enabled: !!tenantId && enabled,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.tenant(tenantId) }),
    meta: { successMessage: "billing:toast.subscriptionUpdated", silentError: true },
  });
}

export interface CheckoutResult {
  status: "active" | "checkout";
  checkout_url?: string;
  provider?: string;
}

/**
 * Starts a plan change. The server either activates it directly (free plan, or no card provider
 * for the currency) or returns a hosted-checkout URL, which this follows; the provider then
 * returns the admin to the billing page.
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
        window.location.href = res.checkout_url;
        return;
      }
      qc.invalidateQueries({ queryKey: billingKeys.tenant(tenantId) });
    },
    meta: { successMessage: "billing:toast.subscriptionUpdated", silentError: true },
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
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.tenant(tenantId) }),
    meta: { successMessage: "billing:toast.subscriptionWillCancelAt", silentError: true },
  });
}

export type BillingInterval = "month" | "year";

/**
 * Returns the plan code for a tier and interval: "<tier>_year" for a paid tier billed yearly.
 * Free and enterprise have no annual variant.
 */
export function planCodeForTier(tier: string, interval: BillingInterval): string {
  return interval === "year" && tier !== "free" && tier !== "enterprise" ? `${tier}_year` : tier;
}

/**
 * Starts a paid checkout for a plan chosen at signup, before any org exists. The org spec rides
 * along and the org is created only when payment completes, so an abandoned payment leaves
 * nothing behind. Returns the hosted-checkout URL to redirect to.
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
