// Request/reply endpoints under `/v1/qeetai`; turn streaming is in ai/streaming-client.ts.

import { useQuery } from "@tanstack/react-query";
import type { z } from "zod";

import { useOrganizationId } from "@/platform/auth/session";
import { qeetaiKeys } from "./keys";
import { assured } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";

// configured, available and source are always sent (internal/operations/qeetai/http.go, status);
// the document has only `configured`, and as optional. `available`: Qeet AI can be
// used, on the organisation's own key (any plan) or the platform key on a plan that includes it.
export const qeetaiStatusSchema = assured<Answer<"/v1/qeetai/status">>()(
  "configured",
  "available",
  "source",
);
export type QeetAIStatus = z.infer<typeof qeetaiStatusSchema>;

/** Where the effective Qeet AI provider comes from for this organisation. */
export type ProviderSource = QeetAIStatus["source"];

/** Provider identifiers a tenant can bring (BYOK). */
export type QeetAIProvider = "anthropic" | "openai" | "azure";

/**
 * Masked provider config the console renders (never key material): `last4` of the organisation's
 * own key when set, and `platform_fallback` when a deployment-level key exists as a fallback.
 */
export type QeetAIProviderConfig = Answer<"/v1/qeetai/provider-config">;

/** Write payload for setting/rotating the tenant's BYOK key. */
export interface SetQeetAIProviderInput {
  provider: QeetAIProvider;
  model: string;
  api_key: string;
  base_url?: string;
  max_tokens?: number;
}

/** Server conversation shape (the subset the client consumes). */
// The server always sends these (internal/operations/qeetai/qeetai.go, Conversation); the document
// marks them optional.
const createdConversation = assured<Answer<"/v1/qeetai/conversations", "post">>()(
  "id",
  "title",
  "pinned",
  "created_at",
  "updated_at",
);
export type ServerConversation = z.infer<typeof createdConversation>;

/**
 * Returns whether Qeet AI is on for the organisation. Cached for minutes, never retried and
 * silent: Qeet AI off is a normal state, not an error to toast.
 */
export function useQeetAIStatus(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: qeetaiKeys.status(organizationId),
    queryFn: ({ signal }) =>
      backend.get("/v1/qeetai/status", { signal, schema: qeetaiStatusSchema }),
    enabled: !!organizationId && enabled,
    staleTime: 5 * 60_000,
    retry: false,
    meta: { silent: true },
  });
}

/** Creates the server-side conversation a local one streams its turns to. */
export function createQeetAIConversation(title?: string): Promise<ServerConversation> {
  return backend.post("/v1/qeetai/conversations", {
    body: title ? { title } : {},
    schema: createdConversation,
  });
}

// The organisation's own provider key (BYOK): reading its settings needs secret.read.

/** Returns the organisation's effective provider settings, with the key masked. */
export function useQeetAIProviderConfig(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: qeetaiKeys.providerConfig(organizationId),
    queryFn: ({ signal }) => backend.get("/v1/qeetai/provider-config", { signal }),
    enabled: !!organizationId && enabled,
    staleTime: 30_000,
    retry: false,
  });
}

// Saving, testing and removing a key are in provider-config.ts: only the settings page uses them.
