// The secrets API returns metadata only; a value comes back only from an explicit, audited reveal.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useOrganizationId } from "@/platform/auth/session";
import { developerKeys } from "./keys";
import { backend } from "@/platform/api/backend";

export interface Secret {
  id: string;
  name: string;
  scope: string;
  last4: string;
  created_at: string;
  updated_at: string;
}

export function useSecrets(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: developerKeys.secrets(organizationId),
    enabled: enabled && !!organizationId,
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/secrets", {
        path: { organizationID: organizationId ?? "" },
      }),
  });
}

export function useCreateSecret() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; scope: string; value: string }) =>
      backend.post("/v1/organizations/{organizationID}/secrets", {
        path: { organizationID: organizationId ?? "" },
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.secrets(organizationId) }),
    meta: { successMessage: "developer:toast.secretCreated", silentError: true }, // the sheet shows the error
  });
}

export function useRotateSecret() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      backend.patch("/v1/organizations/{organizationID}/secrets/{id}", {
        path: { organizationID: organizationId ?? "", id },
        body: { value },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.secrets(organizationId) }),
    meta: { successMessage: "developer:toast.secretRotated", silentError: true }, // the sheet shows the error
  });
}

const revealedSecretSchema = z.object({ value: z.string() });

export function useRevealSecret() {
  const organizationId = useOrganizationId();
  return useMutation({
    gcTime: 0, // the response holds a secret shown once; drop it once nothing shows it
    mutationFn: (id: string) =>
      backend.post("/v1/organizations/{organizationID}/secrets/{id}/reveal", {
        path: { organizationID: organizationId ?? "", id },
        schema: revealedSecretSchema,
      }),
    meta: { silent: true },
  });
}

export function useDeleteSecret() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      backend.delete("/v1/organizations/{organizationID}/secrets/{id}", {
        path: { organizationID: organizationId ?? "", id },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.secrets(organizationId) }),
    meta: { successMessage: "developer:toast.secretDeleted" },
  });
}
