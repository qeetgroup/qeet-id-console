// The organisation's request rate limits: a token bucket per organisation, per person and per
// API key, on every signed-in request. An organisation may lower them, never raise them above the
// platform's; resetting returns them to the platform's. A change applies at once.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

export interface LimitConfig {
  rate: number; // requests a second the bucket refills by, from 0.01
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
    // A bucket left out stays as it is.
    mutationFn: (body: Partial<TenantLimits>) =>
      api<TenantLimits>(`/v1/tenants/${tenantId}/rate-limits`, { method: "PUT", body }),
    onSuccess: (data) => qc.setQueryData(securityKeys.rateLimits(tenantId), data),
    meta: { successMessage: "security:toast.rateLimitsSaved", silentError: true }, // the page shows it
  });
}

export function useResetRateLimits() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/v1/tenants/${tenantId}/rate-limits`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.rateLimits(tenantId) }),
    meta: { successMessage: "security:toast.rateLimitsResetTo" },
  });
}
