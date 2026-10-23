import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { api } from "@/platform/api/client";
import { useTenantId, useUserId } from "@/platform/auth/session";

import { clearStashedProfile, readPendingOnboarding } from "./onboarding-profile";

type TenantRec = {
  id: string;
  slug: string;
  logo_url?: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * Writes the profile stashed at org creation to that organization's metadata, once, on its first
 * dashboard load. Best-effort: a failure keeps the stash for a later load to retry.
 */
export function useApplyOnboardingProfile() {
  const tenantId = useTenantId();
  const userId = useUserId();
  const qc = useQueryClient();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !tenantId) return;
    const pending = readPendingOnboarding(userId);
    if (!pending) return;
    ran.current = true;

    void (async () => {
      try {
        const tenant = await api<TenantRec>(`/v1/tenants/${tenantId}`);
        // Only the organization it was entered for, never one left by an abandoned checkout.
        if (tenant.slug !== pending.slug) return;
        const meta = (tenant.metadata ?? {}) as Record<string, unknown>;
        // Don't clobber an org that already has a profile — just drop the stash.
        if (meta.onboarding) {
          clearStashedProfile();
          return;
        }
        const { logo_url, ...segmentation } = pending.profile; // logo_url isn't metadata
        const body: Record<string, unknown> = { metadata: { ...meta, onboarding: segmentation } };
        if (logo_url && !tenant.logo_url) body.logo_url = logo_url;
        await api(`/v1/tenants/${tenantId}`, { method: "PATCH", body });
        clearStashedProfile();
        qc.invalidateQueries({ queryKey: ["tenant", tenantId] });
        qc.invalidateQueries({ queryKey: ["tenants"] });
      } catch {
        ran.current = false; // let a later run retry
      }
    })();
  }, [tenantId, userId, qc]);
}
