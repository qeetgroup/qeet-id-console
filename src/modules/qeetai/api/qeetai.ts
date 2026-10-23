// Request/reply endpoints under `/v1/qeetai`; turn streaming is in ai/streaming-client.ts.

import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

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

export const QEETAI_STATUS_KEY = ["qeetai", "status"] as const;

/**
 * Returns whether Qeet AI is configured. Cached for minutes, never retried and silent: an
 * unconfigured deployment is a normal state, not an error to toast.
 */
export function useQeetAIStatus() {
  return useQuery({
    queryKey: QEETAI_STATUS_KEY,
    queryFn: ({ signal }) => api<QeetAIStatus>("/v1/qeetai/status", { signal }),
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

// The tenant's own provider key (BYOK): the server requires secret.write.

export const QEETAI_PROVIDER_CONFIG_KEY = ["qeetai", "provider-config"] as const;

/** Returns the tenant's effective provider config, with the key masked. */
export function useQeetAIProviderConfig(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...QEETAI_PROVIDER_CONFIG_KEY, tenantId],
    queryFn: ({ signal }) => api<QeetAIProviderConfig>("/v1/qeetai/provider-config", { signal }),
    enabled: !!tenantId && enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** Sets or rotates the tenant's own provider key. */
export function setQeetAIProviderConfig(
  input: SetQeetAIProviderInput,
): Promise<QeetAIProviderConfig> {
  return api<QeetAIProviderConfig>("/v1/qeetai/provider-config", { method: "PUT", body: input });
}

/** Checks a provider key and endpoint with a live call, without saving them. */
export function testQeetAIProviderConfig(input: SetQeetAIProviderInput): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>("/v1/qeetai/provider-config/test", { method: "POST", body: input });
}

/** Removes the tenant's own key, falling back to the platform key, if any. */
export function deleteQeetAIProviderConfig(): Promise<void> {
  return api<void>("/v1/qeetai/provider-config", { method: "DELETE" });
}
