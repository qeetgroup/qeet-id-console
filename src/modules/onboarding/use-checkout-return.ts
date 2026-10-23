import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { api } from "@/platform/api/client";
import { useTenantId, useUserId } from "@/platform/auth/session";
import { switchToTenant } from "@/modules/authentication";

import { readPendingOnboarding } from "./onboarding-profile";

type TenantListItem = { id: string; slug: string };

/**
 * Handles the return from a hosted payment. On success it polls for the organization just paid for
 * and switches the session into it; on cancel it toasts that no organization was created.
 * `finalizing` is true while it waits.
 */
export function useCheckoutReturn(): { finalizing: boolean } {
  const [finalizing, setFinalizing] = useState(false);
  const started = useRef(false);
  const currentTenantId = useTenantId();
  const userId = useUserId();

  useEffect(() => {
    if (started.current) return;
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("checkout");
    const rzpLinkId = params.get("razorpay_payment_link_id");
    const rzpStatus = params.get("razorpay_payment_link_status");
    // Handle either our own ?checkout flag or a Razorpay payment-link redirect.
    if (outcome !== "success" && outcome !== "cancelled" && !rzpLinkId) return;
    started.current = true;

    const cancelled =
      outcome === "cancelled" || (!!rzpLinkId && rzpStatus !== null && rzpStatus !== "paid");
    if (cancelled) {
      toast.message("Payment cancelled — no organization was created.");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    setFinalizing(true);
    void (async () => {
      // Posting the signed Razorpay params lets the server verify the payment and create the org
      // where the webhook can't reach it (a local server); it is idempotent with the webhook.
      if (rzpLinkId) {
        const body: Record<string, string> = {};
        for (const k of [
          "razorpay_payment_id",
          "razorpay_payment_link_id",
          "razorpay_payment_link_reference_id",
          "razorpay_payment_link_status",
          "razorpay_signature",
        ]) {
          const v = params.get(k);
          if (v) body[k] = v;
        }
        await api<{ ok?: boolean }>("/v1/billing/razorpay/verify", { method: "POST", body }).catch(
          () => null,
        );
      }

      // The paid organization is the one with the stashed slug. Without a stash, it is one that
      // wasn't there at the first poll: "the newest" could be another organization of the user's.
      const pendingSlug = readPendingOnboarding(userId)?.slug;
      let existing: Set<string> | null = null;
      const MAX_ATTEMPTS = 30; // ~50s with the ramp below: provisioning can lag past 10s
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const res = await api<{ items: TenantListItem[] }>("/v1/tenants").catch(() => null);
        const items = res?.items ?? [];
        const seen = existing;
        const paid = pendingSlug
          ? items.find((t) => t.slug === pendingSlug)
          : seen && items.find((t) => !seen.has(t.id));
        existing ??= new Set(items.map((t) => t.id));
        if (paid && paid.id === currentTenantId) {
          setFinalizing(false);
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }
        if (paid) {
          await switchToTenant(paid.id); // replaces the scoped session + reloads into the org
          return;
        }
        await new Promise((r) => setTimeout(r, attempt < 10 ? 1000 : 2000));
      }
      // Paid but not provisioned yet: say so, rather than look as if nothing happened.
      setFinalizing(false);
      window.history.replaceState({}, "", window.location.pathname);
      toast.message(
        "Payment received — we're finishing your organization setup. This can take a moment; refresh shortly or contact support if it doesn't appear.",
      );
    })();
  }, [currentTenantId, userId]);

  return { finalizing };
}
