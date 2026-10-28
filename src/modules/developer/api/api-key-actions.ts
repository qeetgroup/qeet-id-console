// Creating and revoking API keys: only the keys page uses them, so the shell (which carries the
// module's barrel) doesn't. A key's secret is returned once, on create.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import {
  type ApiKeyList,
  type CreateApiKeyInput,
  type CreatedApiKey,
  createdApiKeySchema,
} from "./api-keys";
import { developerKeys } from "./keys";

/** Creates an API key and resolves with it and its plaintext secret, returned this once. */
export function createApiKey(input: CreateApiKeyInput): Promise<CreatedApiKey> {
  return api("/v1/api-keys", { method: "POST", body: input, schema: createdApiKeySchema });
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
