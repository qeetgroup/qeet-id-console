// One-shot: when a freshly-created org first loads the dashboard, apply the
// segmentation stashed during creation to the tenant's metadata. Runs for both
// free (created inline) and paid (provisioned after checkout) since both land
// on the dashboard scoped to the new tenant. Best-effort — a failure keeps the
// stash so a later load can retry; nothing user-facing breaks if it never runs.

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { api } from "@/lib/api";
import { useTenantId } from "@/lib/auth";

import { clearStashedProfile, readStashedProfile } from "./onboarding-profile";

type TenantRec = { id: string; logo_url?: string; metadata?: Record<string, unknown> | null };

export function useApplyOnboardingProfile() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !tenantId) return;
    const profile = readStashedProfile();
    if (!profile) return;
    ran.current = true;

    void (async () => {
      try {
        const tenant = await api<TenantRec>(`/v1/tenants/${tenantId}`);
        const meta = (tenant.metadata ?? {}) as Record<string, unknown>;
        // Don't clobber an org that already has a profile — just drop the stash.
        if (meta.onboarding) {
          clearStashedProfile();
          return;
        }
        // Segmentation goes into metadata.onboarding; the logo is a top-level
        // column, applied only when the org doesn't already have one.
        const { logo_url, ...segmentation } = profile;
        const body: Record<string, unknown> = { metadata: { ...meta, onboarding: segmentation } };
        if (logo_url && !tenant.logo_url) body.logo_url = logo_url;
        await api(`/v1/tenants/${tenantId}`, { method: "PATCH", body });
        clearStashedProfile();
        qc.invalidateQueries({ queryKey: ["tenant", tenantId] });
        qc.invalidateQueries({ queryKey: ["tenants"] });
      } catch {
        ran.current = false; // allow a retry on a later mount
      }
    })();
  }, [tenantId, qc]);
}
