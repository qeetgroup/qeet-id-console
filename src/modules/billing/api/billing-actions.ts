// The Billing page's writes. Only the page uses them, so they stay out of api/billing.ts, which the
// module's barrel (and every page that gates on the plan) carries.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import i18n from "@/i18n";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import type { BillingProfile, CheckoutResult, Subscription } from "./billing";
import { billingKeys } from "./keys";

/** Starts a no-card trial of a paid tier; only an organisation with no subscription yet may. */
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
 * Starts a plan change. The server either activates it directly (Free, or invoice-only billing
 * where no card provider takes the currency) or returns a hosted-checkout URL, which this follows;
 * the provider then returns the administrator to the billing page.
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
      // Only a plan that took effect is "changed": a checkout hasn't changed anything yet.
      toast.success(i18n.t("billing:toast.subscriptionUpdated"));
      qc.invalidateQueries({ queryKey: billingKeys.tenant(tenantId) });
    },
    meta: { silent: true },
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
