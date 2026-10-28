// The secrets API returns metadata only; a value comes back only from an explicit, audited reveal.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { developerKeys } from "./keys";

export interface Secret {
  id: string;
  name: string;
  scope: string;
  last4: string;
  created_at: string;
  updated_at: string;
}

export function useSecrets(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: developerKeys.secrets(tenantId),
    enabled: enabled && !!tenantId,
    queryFn: () => api<{ items: Secret[] }>(`/v1/tenants/${tenantId}/secrets`),
  });
}

export function useCreateSecret() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; scope: string; value: string }) =>
      api<Secret>(`/v1/tenants/${tenantId}/secrets`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.secrets(tenantId) }),
    meta: { successMessage: "developer:toast.secretCreated", silentError: true }, // the sheet shows the error
  });
}

export function useRotateSecret() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      api<Secret>(`/v1/tenants/${tenantId}/secrets/${id}`, {
        method: "PATCH",
        body: { value },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.secrets(tenantId) }),
    meta: { successMessage: "developer:toast.secretRotated", silentError: true }, // the sheet shows the error
  });
}

const revealedSecretSchema = z.object({ value: z.string() });

export function useRevealSecret() {
  const tenantId = useTenantId();
  return useMutation({
    gcTime: 0, // the response holds a secret shown once; drop it once nothing shows it
    mutationFn: (id: string) =>
      api(`/v1/tenants/${tenantId}/secrets/${id}/reveal`, {
        method: "POST",
        schema: revealedSecretSchema,
      }),
    meta: { silent: true },
  });
}

export function useDeleteSecret() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/tenants/${tenantId}/secrets/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.secrets(tenantId) }),
    meta: { successMessage: "developer:toast.secretDeleted" },
  });
}
