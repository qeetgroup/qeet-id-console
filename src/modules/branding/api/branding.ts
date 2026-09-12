import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import type { Branding } from "../branding-model";

export const BRANDING_KEY = ["branding"] as const;

export function useBranding(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...BRANDING_KEY, tenantId],
    enabled: !!tenantId && enabled,
    queryFn: () => api<Branding>(`/v1/tenants/${tenantId}/branding`),
  });
}

export function saveBranding(tenantId: string, branding: Branding) {
  return api<Branding>(`/v1/tenants/${tenantId}/branding`, { method: "PUT", body: branding });
}
