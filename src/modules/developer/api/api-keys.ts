// API keys for machine-to-machine access. A key's plaintext secret is returned once, on create,
// and stored hashed, so show it immediately: it can't be read again.

import { queryOptions, useQuery } from "@tanstack/react-query";
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

export const createdApiKeySchema = z.object({
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
