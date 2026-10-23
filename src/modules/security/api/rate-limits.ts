// The organization's request rate limits: a token bucket per organization, per person and per
// API key. Resetting returns them to the platform defaults.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

export interface LimitConfig {
  rate: number; // tokens added per second
  capacity: number; // the burst a full bucket allows
}

export interface TenantLimits {
  tenant: LimitConfig;
  user: LimitConfig;
  api_key: LimitConfig;
}

export function useRateLimits() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: securityKeys.rateLimits(tenantId),
    queryFn: () => api<TenantLimits>(`/v1/tenants/${tenantId}/rate-limits`),
    enabled: !!tenantId,
  });
}

export function useUpdateRateLimits() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TenantLimits) =>
      api<TenantLimits>(`/v1/tenants/${tenantId}/rate-limits`, { method: "PUT", body }),
    onSuccess: (data) => qc.setQueryData(securityKeys.rateLimits(tenantId), data),
    meta: { successMessage: "Rate limits saved", silentError: true }, // the page shows it
  });
}

export function useResetRateLimits() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/v1/tenants/${tenantId}/rate-limits`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.rateLimits(tenantId) }),
    meta: { successMessage: "Rate limits reset to platform defaults" },
  });
}
