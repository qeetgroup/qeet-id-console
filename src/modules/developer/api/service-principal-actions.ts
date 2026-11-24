// Creating and disabling machine identities: only their page uses them, so the shell doesn't. The
// client secret is returned once, on create.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganizationId } from "@/platform/auth/session";

import { developerKeys } from "./keys";
import {
  type CreatedServicePrincipal,
  type CreateServicePrincipalInput,
  createdServicePrincipalSchema,
} from "./service-principals";
import { backend } from "@/platform/api/backend";

/** Creates a machine identity and resolves with it and its client secret, returned this once. */
export function createServicePrincipal(
  input: CreateServicePrincipalInput,
): Promise<CreatedServicePrincipal> {
  return backend.post("/v1/service-principals", {
    body: input,
    schema: createdServicePrincipalSchema,
  });
}

export function useCreateServicePrincipal() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createServicePrincipal,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: developerKeys.servicePrincipals(organizationId) }),
    gcTime: 0, // the response holds a secret shown once; drop it once nothing shows it
    meta: { successMessage: "developer:toast.machineIdentityCreated", silentError: true }, // the sheet shows it
  });
}

export function useDisableServicePrincipal() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backend.delete("/v1/service-principals/{id}", { path: { id } }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: developerKeys.servicePrincipals(organizationId) }),
    meta: { successMessage: "developer:toast.machineIdentityDisabled" },
  });
}
