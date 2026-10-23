// OAuth grant administration. Access tokens are stateless JWTs, so what can be listed and revoked
// is the stored refresh-token grant per (client, user); revoking it ends the rotation chain.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authKeys } from "./keys";

export interface OAuthGrant {
  id: string;
  client_id: string;
  user_id: string;
  user_email: string;
  scopes: string[];
  issued_at: string;
  expires_at: string;
}

export function useOAuthGrants() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: authKeys.oauthGrants(tenantId),
    enabled: !!tenantId,
    queryFn: () => api<{ items: OAuthGrant[] }>(`/v1/tenants/${tenantId}/oauth/grants`),
  });
}

export function useRevokeOAuthGrant() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/tenants/${tenantId}/oauth/grants/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.oauthGrants(tenantId) }),
    meta: { successMessage: "authentication:toast.grantRevoked" },
  });
}
