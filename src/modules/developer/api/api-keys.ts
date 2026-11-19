// API keys for machine-to-machine access. A key's plaintext secret is returned once, on create,
// and stored hashed, so show it immediately: it can't be read again.

import { queryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useOrganizationId } from "@/platform/auth/session";

import { developerKeys } from "./keys";
import { strictly } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer, Body } from "@/platform/api/contract";

const apiKeySchema = z.object({
  id: z.string(),
  organization_id: z.string(),
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

const apiKeyListSchema = strictly<Answer<"/v1/organizations/{organizationID}/api-keys">>()(
  z.object({ items: z.array(apiKeySchema) }),
);
export type ApiKeyList = z.infer<typeof apiKeyListSchema>;

export const createdApiKeySchema = strictly<Answer<"/v1/api-keys", "post">>()(
  z.object({
    api_key: apiKeySchema,
    // Shown this once. Absent only if the server failed to return it, which the keys page reports.
    secret: z.string().optional(),
    warning: z.string().optional(),
  }),
);
export type CreatedApiKey = z.infer<typeof createdApiKeySchema>;

// The document requires organization_id; the server takes the caller's in any case.
export type CreateApiKeyInput = Body<"/v1/api-keys", "post">;

/** Returns a tenant's API keys, rejecting a response that isn't a key list. */
export function listApiKeys(organizationId: string | null): Promise<ApiKeyList> {
  return backend.get("/v1/organizations/{organizationID}/api-keys", {
    path: { organizationID: organizationId ?? "" },
    schema: apiKeyListSchema,
  });
}

export const apiKeyQueries = {
  list: (organizationId: string | null) =>
    queryOptions({
      queryKey: developerKeys.apiKeys(organizationId),
      queryFn: () => listApiKeys(organizationId),
      enabled: !!organizationId,
    }),
};

export function useApiKeys() {
  return useQuery(apiKeyQueries.list(useOrganizationId()));
}
