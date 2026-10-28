// The SCIM token's changes, apart from its reads (scim.ts, which the Dashboard carries): only the
// SCIM page loads these. Each refreshes SCIM and the Directories list. Both ask the person to
// confirm it's them (internal/bootstrap/stepup.go).

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { directoryKeys } from "@/modules/directory";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authKeys } from "./keys";
import { scimConfigSchema } from "./scim";

const scimTokenSchema = z.object({
  token: z.string().min(1), // shown this once
  config: scimConfigSchema,
});

function useRefresh() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return {
    tenantId,
    refresh: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: authKeys.scim(tenantId) }),
        qc.invalidateQueries({ queryKey: directoryKeys.tenant(tenantId) }),
      ]),
  };
}

/**
 * Makes the token, or replaces it: the old one stops working at once. The token is in the
 * response this once and stored only hashed, so it is shown straight away and never again.
 */
export function useRotateScimToken() {
  const { tenantId, refresh } = useRefresh();
  return useMutation({
    gcTime: 0, // the response holds a secret shown once; drop it once nothing shows it
    mutationFn: () =>
      api(`/v1/tenants/${tenantId}/scim/token`, { method: "POST", schema: scimTokenSchema }),
    onSuccess: () => refresh(),
  });
}

/** Revokes the token: the identity provider can no longer send changes. */
export function useRevokeScimToken() {
  const { tenantId, refresh } = useRefresh();
  return useMutation({
    mutationFn: () => api<void>(`/v1/tenants/${tenantId}/scim/token`, { method: "DELETE" }),
    onSuccess: () => refresh(),
    meta: { successMessage: "connections:toast.scimRevoked" },
  });
}
