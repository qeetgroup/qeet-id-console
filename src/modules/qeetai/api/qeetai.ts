// Request/reply endpoints under `/v1/qeetai`; turn streaming is in ai/streaming-client.ts.

import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { qeetaiKeys } from "./keys";

export interface QeetAIStatus {
  configured: boolean;
  /**
   * True when Qeet AI can be used: the tenant's own key (any plan), or the platform key on a
   * plan that includes it. Servers that omit it send only `configured`.
   */
  available?: boolean;
  provider?: string;
  model?: string;
  source?: ProviderSource;
}

/** Where the effective Qeet AI provider comes from for this tenant. */
export type ProviderSource = "tenant" | "platform" | "none";

/** Provider identifiers a tenant can bring (BYOK). */
export type QeetAIProvider = "anthropic" | "openai" | "azure";

/** Masked provider config the console renders (never includes key material). */
export interface QeetAIProviderConfig {
  source: ProviderSource;
  provider?: string;
  model?: string;
  base_url?: string;
  max_tokens?: number;
  last4?: string; // Last 4 chars of the tenant's own key, when set
  platform_fallback?: boolean; // True when a deployment-level key exists as a fallback
}

/** Write payload for setting/rotating the tenant's BYOK key. */
export interface SetQeetAIProviderInput {
  provider: QeetAIProvider;
  model: string;
  api_key: string;
  base_url?: string;
  max_tokens?: number;
}

/** Server conversation shape (the subset the client consumes). */
export interface ServerConversation {
  id: string;
  title: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Returns whether Qeet AI is on for the organisation. Cached for minutes, never retried and
 * silent: Qeet AI off is a normal state, not an error to toast.
 */
export function useQeetAIStatus(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: qeetaiKeys.status(tenantId),
    queryFn: ({ signal }) => api<QeetAIStatus>("/v1/qeetai/status", { signal }),
    enabled: !!tenantId && enabled,
    staleTime: 5 * 60_000,
    retry: false,
    meta: { silent: true },
  });
}

/** Creates the server-side conversation a local one streams its turns to. */
export function createQeetAIConversation(title?: string): Promise<ServerConversation> {
  return api<ServerConversation>("/v1/qeetai/conversations", {
    method: "POST",
    body: title ? { title } : {},
  });
}

// The organisation's own provider key (BYOK): reading its settings needs secret.read.

/** Returns the organisation's effective provider settings, with the key masked. */
export function useQeetAIProviderConfig(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: qeetaiKeys.providerConfig(tenantId),
    queryFn: ({ signal }) => api<QeetAIProviderConfig>("/v1/qeetai/provider-config", { signal }),
    enabled: !!tenantId && enabled,
    staleTime: 30_000,
    retry: false,
  });
}

// Saving, testing and removing a key are in provider-config.ts: only the settings page uses them.
