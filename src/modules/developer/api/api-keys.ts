// API keys for machine-to-machine access. A key's plaintext secret is returned once, on create,
// and stored hashed, so show it immediately: it can't be read again.

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import { developerKeys } from "./keys";

const apiKeySchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  user_id: z.string().nullish(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(z.string()).nullable(),
  expires_at: z.string().nullish(),
  last_used_at: z.string().nullish(),
  revoked_at: z.string().nullish(),
  created_at: z.string(),
});
export type ApiKey = z.infer<typeof apiKeySchema>;

const apiKeyListSchema = z.object({ items: z.array(apiKeySchema) });
export type ApiKeyList = z.infer<typeof apiKeyListSchema>;

const createdApiKeySchema = z.object({
  api_key: apiKeySchema,
  // Shown this once. Absent only if the server failed to return it, which the keys page reports.
  secret: z.string().optional(),
  warning: z.string().optional(),
});
export type CreatedApiKey = z.infer<typeof createdApiKeySchema>;

export type CreateApiKeyInput = {
  tenant_id: string;
  name: string;
  scopes?: string[];
  expires_at?: string;
};

/** Returns a tenant's API keys, rejecting a response that isn't a key list. */
export function listApiKeys(tenantId: string | null): Promise<ApiKeyList> {
  return api(`/v1/tenants/${tenantId}/api-keys`, { schema: apiKeyListSchema });
}

/** Creates an API key and resolves with it and its plaintext secret, returned this once. */
export function createApiKey(input: CreateApiKeyInput): Promise<CreatedApiKey> {
  return api("/v1/api-keys", { method: "POST", body: input, schema: createdApiKeySchema });
}

export const apiKeyQueries = {
  list: (tenantId: string | null) =>
    queryOptions({
      queryKey: developerKeys.apiKeys(tenantId),
      queryFn: () => listApiKeys(tenantId),
      enabled: !!tenantId,
    }),
};

export function useApiKeys() {
  return useQuery(apiKeyQueries.list(useTenantId()));
}

export function useCreateApiKey() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createApiKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.apiKeys(tenantId) }),
    gcTime: 0, // the response holds a secret shown once; drop it once nothing shows it
    meta: { successMessage: "developer:toast.apiKeyCreated", silentError: true }, // the sheet shows the error
  });
}

/** Revokes a key, marking it revoked in the list at once and restoring it if the call fails. */
export function useRevokeApiKey() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const listKey = developerKeys.apiKeys(tenantId);
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/api-keys/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<ApiKeyList>(listKey);
      const stamp = new Date().toISOString();
      qc.setQueryData<ApiKeyList>(listKey, (prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((k) => (k.id === id ? { ...k, revoked_at: stamp } : k)),
            }
          : prev,
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => qc.setQueryData(listKey, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: listKey }),
    meta: { successMessage: "developer:toast.apiKeyRevoked" },
  });
}
