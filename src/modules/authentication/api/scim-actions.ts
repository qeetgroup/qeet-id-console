// The SCIM token's changes, apart from its reads (scim.ts, which the Dashboard carries): only the
// SCIM page loads these. Each refreshes SCIM and the Directories list. Both ask the person to
// confirm it's them (internal/bootstrap/stepup.go).

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { directoryKeys } from "@/modules/directory";
import { useOrganizationId } from "@/platform/auth/session";
import { authKeys } from "./keys";
import { scimConfigSchema } from "./scim";
import { backend } from "@/platform/api/backend";

const scimTokenSchema = z.object({
  token: z.string().min(1), // shown this once
  config: scimConfigSchema,
});

function useRefresh() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return {
    organizationId,
    refresh: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: authKeys.scim(organizationId) }),
        qc.invalidateQueries({ queryKey: directoryKeys.organization(organizationId) }),
      ]),
  };
}

/**
 * Makes the token, or replaces it: the old one stops working at once. The token is in the
 * response this once and stored only hashed, so it is shown straight away and never again.
 */
export function useRotateScimToken() {
  const { organizationId, refresh } = useRefresh();
  return useMutation({
    gcTime: 0, // the response holds a secret shown once; drop it once nothing shows it
    mutationFn: () =>
      backend.post("/v1/organizations/{organizationID}/scim/token", {
        path: { organizationID: organizationId ?? "" },
        schema: scimTokenSchema,
      }),
    onSuccess: () => refresh(),
  });
}

/** Revokes the token: the identity provider can no longer send changes. */
export function useRevokeScimToken() {
  const { organizationId, refresh } = useRefresh();
  return useMutation({
    mutationFn: () =>
      backend.delete("/v1/organizations/{organizationID}/scim/token", {
        path: { organizationID: organizationId ?? "" },
      }),
    onSuccess: () => refresh(),
    meta: { successMessage: "connections:toast.scimRevoked" },
  });
}
