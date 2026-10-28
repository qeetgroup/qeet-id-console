// Creating and disabling machine identities: only their page uses them, so the shell doesn't. The
// client secret is returned once, on create.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import { developerKeys } from "./keys";
import {
  type CreatedServicePrincipal,
  type CreateServicePrincipalInput,
  createdServicePrincipalSchema,
} from "./service-principals";

/** Creates a machine identity and resolves with it and its client secret, returned this once. */
export function createServicePrincipal(
  input: CreateServicePrincipalInput,
): Promise<CreatedServicePrincipal> {
  return api("/v1/service-principals", {
    method: "POST",
    body: input,
    schema: createdServicePrincipalSchema,
  });
}

export function useCreateServicePrincipal() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createServicePrincipal,
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.servicePrincipals(tenantId) }),
    gcTime: 0, // the response holds a secret shown once; drop it once nothing shows it
    meta: { successMessage: "developer:toast.machineIdentityCreated", silentError: true }, // the sheet shows it
  });
}

export function useDisableServicePrincipal() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/service-principals/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.servicePrincipals(tenantId) }),
    meta: { successMessage: "developer:toast.machineIdentityDisabled" },
  });
}
