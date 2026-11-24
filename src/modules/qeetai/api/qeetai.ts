// Request/reply endpoints under `/v1/qeetai`; turn streaming is in ai/streaming-client.ts.

import { useQuery } from "@tanstack/react-query";

import { useOrganizationId } from "@/platform/auth/session";
import { qeetaiKeys } from "./keys";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";

// `available`: Qeet AI can be used, on the organisation's own key (any plan) or the platform key on
// a plan that includes it.
export type QeetAIStatus = Answer<"/v1/qeetai/status">;

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

/** A server-side conversation. */
export type ServerConversation = Answer<"/v1/qeetai/conversations", "post">;

/**
 * Returns whether Qeet AI is on for the organisation. Cached for minutes, never retried and
 * silent: Qeet AI off is a normal state, not an error to toast.
 */
export function useQeetAIStatus(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: qeetaiKeys.status(organizationId),
    queryFn: ({ signal }) => backend.get("/v1/qeetai/status", { signal }),
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
