import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/platform/api/client";
import { useTenantId, useUserId } from "@/platform/auth/session";

import { loadPage } from "./load-page";
import { type PendingOnboarding, readPendingOnboarding } from "./onboarding-profile";

type TenantListItem = { id: string; slug: string };

/** What a hosted checkout adds to the create page's address when it sends the person back. */
export interface CheckoutParams {
  checkout?: "success" | "cancelled";
  razorpay_payment_id?: string;
  razorpay_payment_link_id?: string;
  razorpay_payment_link_reference_id?: string;
  razorpay_payment_link_status?: string;
  razorpay_signature?: string;
}

const RAZORPAY_FIELDS = [
  "razorpay_payment_id",
  "razorpay_payment_link_id",
  "razorpay_payment_link_reference_id",
  "razorpay_payment_link_status",
  "razorpay_signature",
] as const;

export type CheckoutReturn =
  | { state: "none" }
  | { state: "finishing"; pending: PendingOnboarding | null }
  | { state: "slow"; pending: PendingOnboarding | null; checkAgain: () => void }
  | { state: "cancelled"; pending: PendingOnboarding | null };

const ATTEMPTS = 30; // ~50s with the ramp below: provisioning can lag past 10s

/**
 * The return from a hosted payment, on the create page. Paid: it waits for the organisation the
 * payment creates and opens it; if that takes too long it says so, with a way to check again.
 * Cancelled: nothing was created, and what was entered (kept in this browser) comes back.
 * `clearParams` takes the checkout's fields out of the address once they're read.
 */
export function useCheckoutReturn(params: CheckoutParams, clearParams: () => void): CheckoutReturn {
  const userId = useUserId();
  const currentTenantId = useTenantId();
  const [result, setResult] = useState<CheckoutReturn>({ state: "none" });
  const started = useRef(false);
  const known = useRef<Set<string> | null>(null);

  const wait = useCallback(
    async (pending: PendingOnboarding | null) => {
      // The paid organisation is the one with the stashed slug. Without a stash, it is one that
      // wasn't there at the first look: "the newest" could be another of the person's.
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const items = (await api<{ items: TenantListItem[] }>("/v1/tenants").catch(() => null))
          ?.items;
        if (items) {
          const seen = known.current;
          const paid = pending
            ? items.find((tenant) => tenant.slug === pending.slug)
            : seen && items.find((tenant) => !seen.has(tenant.id));
          known.current ??= new Set(items.map((tenant) => tenant.id));
          if (paid) {
            if (paid.id === currentTenantId) loadPage("/");
            else {
              // Only a checkout return switches, so authentication loads here, not with the page.
              const { switchToTenant } = await import("@/modules/authentication");
              await switchToTenant(paid.id); // moves the session and reloads into it
            }
            return;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, attempt < 10 ? 1000 : 2000));
      }
      // Paid, but not provisioned yet: say so, rather than look as if nothing happened.
      setResult({
        state: "slow",
        pending,
        checkAgain: () => {
          setResult({ state: "finishing", pending });
          void wait(pending);
        },
      });
    },
    [currentTenantId],
  );

  useEffect(() => {
    const linkId = params.razorpay_payment_link_id;
    if (started.current || (!params.checkout && !linkId)) return;
    if (!userId) return; // the session first: the stash belongs to a person
    started.current = true;
    const pending = readPendingOnboarding(userId);
    clearParams();

    const status = params.razorpay_payment_link_status;
    if (params.checkout === "cancelled" || (linkId && status !== undefined && status !== "paid")) {
      setResult({ state: "cancelled", pending });
      return;
    }
    setResult({ state: "finishing", pending });
    void (async () => {
      // Sending the signed Razorpay fields lets the server verify the payment and create the
      // organisation where its webhook can't reach (a local server); it is idempotent with it.
      if (linkId) {
        const body: Record<string, string> = {};
        for (const field of RAZORPAY_FIELDS) {
          const value = params[field];
          if (value) body[field] = value;
        }
        await api("/v1/billing/razorpay/verify", { method: "POST", body }).catch(() => null);
      }
      await wait(pending);
    })();
  }, [params, userId, clearParams, wait]);

  return result;
}
