// The Billing page's writes. Only the page uses them, so they stay out of api/billing.ts, which the
// module's barrel (and every page that gates on the plan) carries.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import i18n from "@/i18n";
import { useOrganizationId } from "@/platform/auth/session";
import { type BillingProfile, billingProfileSchema, type CheckoutResult } from "./billing";
import { billingKeys } from "./keys";
import { backend } from "@/platform/api/backend";

/** Starts a no-card trial of a paid tier; only an organisation with no subscription yet may. */
export function useStartTrial() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { plan_code: string; currency: string }) =>
      backend.post("/v1/organizations/{organizationID}/billing/trial", {
        path: { organizationID: organizationId ?? "" },
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.organization(organizationId) }),
    meta: { successMessage: "billing:toast.trialStarted", silentError: true },
  });
}

export function useSaveBillingProfile() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BillingProfile) =>
      backend.put("/v1/organizations/{organizationID}/billing/profile", {
        path: { organizationID: organizationId ?? "" },
        body,
        schema: billingProfileSchema,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.profile(organizationId) }),
    meta: { successMessage: "billing:toast.billingProfileSaved", silentError: true },
  });
}

/**
 * Starts a plan change. The server either activates it directly (Free, or invoice-only billing
 * where no card provider takes the currency) or returns a hosted-checkout URL, which this follows;
 * the provider then returns the administrator to the billing page.
 */
export function useCheckout() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      plan_code: string;
      currency: string;
      country?: string;
    }): Promise<CheckoutResult> => {
      const base = `${window.location.origin}/settings/billing`;
      return backend.post("/v1/organizations/{organizationID}/billing/checkout", {
        path: { organizationID: organizationId ?? "" },
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
      void qc.invalidateQueries({ queryKey: billingKeys.organization(organizationId) });
    },
    meta: { silent: true },
  });
}

export function useCancelSubscription() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      backend.post("/v1/organizations/{organizationID}/billing/subscription/cancel", {
        path: { organizationID: organizationId ?? "" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.organization(organizationId) }),
    meta: { successMessage: "billing:toast.subscriptionWillCancelAt", silentError: true },
  });
}
