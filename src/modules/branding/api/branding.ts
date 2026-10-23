import { queryOptions, useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import type { Branding } from "../branding-model";
import { brandingKeys } from "./keys";

export const brandingQueries = {
  detail: (tenantId: string | null) =>
    queryOptions({
      queryKey: brandingKeys.tenant(tenantId),
      queryFn: () => api<Branding>(`/v1/tenants/${tenantId}/branding`),
      enabled: !!tenantId,
    }),
};

export function useBranding(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({ ...brandingQueries.detail(tenantId), enabled: !!tenantId && enabled });
}

export function saveBranding(tenantId: string, branding: Branding) {
  return api<Branding>(`/v1/tenants/${tenantId}/branding`, { method: "PUT", body: branding });
}
