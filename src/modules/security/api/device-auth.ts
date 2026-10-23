// OAuth device authorization grants (RFC 8628), each keyed by the user_code a person types on a
// second screen. Revoking a suspicious grant stops it from being redeemed.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

export interface DeviceAuth {
  id: string;
  client_id: string;
  user_code: string;
  status: string;
  user_id: string;
  user_email: string;
  scopes: string[];
  created_at: string;
  expires_at: string;
  last_polled_at: string | null;
}

export function useDeviceAuthorizations() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: securityKeys.deviceAuthorizations(tenantId),
    enabled: !!tenantId,
    queryFn: () => api<{ items: DeviceAuth[] }>(`/v1/tenants/${tenantId}/oauth/devices`),
  });
}

export function useRevokeDeviceAuth() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<void>(`/v1/tenants/${tenantId}/oauth/devices/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: securityKeys.deviceAuthorizations(tenantId) }),
    meta: { successMessage: "Device authorization revoked" },
  });
}
