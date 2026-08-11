import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { api, tokenStore } from "@/lib/api";
import { switchToTenant } from "@/lib/auth";

type TenantListItem = { id: string; created_at?: string };

/**
 * Handles the browser's return from a hosted payment.
 *
 * On `?checkout=success` (a paid signup checkout completed) the organization now
 * exists but the session is still on the previous/no tenant — so we find the
 * newest org the user owns and switch into it (`switchToTenant` reloads into it).
 * We poll briefly to absorb any webhook lag. `?checkout=cancelled` just clears
 * the flag with a toast — importantly, no organization was created.
 *
 * Returns `finalizing` so the caller can show a "wrapping up" state while the
 * org appears and we switch in.
 */
export function useCheckoutReturn(): { finalizing: boolean } {
  const [finalizing, setFinalizing] = useState(false);
  const started = useRef(false);

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
      // A Razorpay redirect carries the signed payment params. Post them so the
      // server verifies the payment and completes the checkout (creating the
      // org) — the async webhook can't reach a local server. Idempotent with the
      // webhook in production.
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

      const current = tokenStore.getTenantId();
      // Poll for up to ~45s (webhook + provisioning can lag well past 10s). A
      // gentle ramp keeps early checks snappy without hammering the API late.
      const MAX_ATTEMPTS = 30;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const res = await api<{ items: TenantListItem[] }>("/v1/tenants").catch(() => null);
        const items = res?.items ?? [];
        const newest = [...items].sort((a, b) =>
          (b.created_at ?? "").localeCompare(a.created_at ?? ""),
        )[0];
        if (newest && newest.id !== current) {
          await switchToTenant(newest.id); // persists a scoped token + reloads into the org
          return;
        }
        await new Promise((r) => setTimeout(r, attempt < 10 ? 1000 : 2000));
      }
      // Still not provisioned — payment succeeded but the org hasn't appeared yet.
      // Tell the user explicitly (don't silently drop) so a paid signup that's
      // finalizing doesn't look like nothing happened; it'll appear on reload.
      setFinalizing(false);
      window.history.replaceState({}, "", window.location.pathname);
      toast.message(
        "Payment received — we're finishing your organization setup. This can take a moment; refresh shortly or contact support if it doesn't appear.",
      );
    })();
  }, []);

  return { finalizing };
}
