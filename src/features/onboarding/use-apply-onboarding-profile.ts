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

type TenantRec = { id: string; metadata?: Record<string, unknown> | null };

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
        await api(`/v1/tenants/${tenantId}`, {
          method: "PATCH",
          body: { metadata: { ...meta, onboarding: profile } },
        });
        clearStashedProfile();
        qc.invalidateQueries({ queryKey: ["tenant", tenantId] });
        qc.invalidateQueries({ queryKey: ["tenants"] });
      } catch {
        ran.current = false; // allow a retry on a later mount
      }
    })();
  }, [tenantId, qc]);
}
