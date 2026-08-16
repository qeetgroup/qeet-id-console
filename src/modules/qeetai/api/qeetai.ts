// QeetAI REST data layer over the Go backend (`/v1/qeetai/*`). Conversation
// streaming lives in features/qeetai/ai/streaming-client.ts; this module owns
// the plain request/reply endpoints: the provider-status probe (used to pick the
// live vs. graceful provider) and server-side conversation creation (used lazily
// the first time a local conversation streams a turn).

import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";

export interface QeetAIStatus {
  configured: boolean;
  // available folds in the plan gate: true only when Qeet AI is configured for
  // the tenant (its own key, or the platform key on a plan that includes it).
  // BYOK (source="tenant") is available on any plan. Older servers omit these.
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
  /** Last 4 chars of the tenant's own key, when set. */
  last4?: string;
  /** True when a deployment-level key exists as a fallback. */
  platform_fallback?: boolean;
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
 * Whether a model provider is configured on the server. Cached for a few minutes
 * and non-retrying — an unconfigured deployment is a normal steady state, not an
 * error, so it must not spam the network or toast.
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

/** Create a server-side conversation and return it (id used for streaming). */
export function createQeetAIConversation(title?: string): Promise<ServerConversation> {
  return api<ServerConversation>("/v1/qeetai/conversations", {
    method: "POST",
    body: title ? { title } : {},
  });
}

// --- BYOK provider config (org owner/admin; gated by secret.write on the server) ---

export const QEETAI_PROVIDER_CONFIG_KEY = ["qeetai", "provider-config"] as const;

/** Read the tenant's effective Qeet AI provider config (masked). */
export function useQeetAIProviderConfig() {
  return useQuery({
    queryKey: QEETAI_PROVIDER_CONFIG_KEY,
    queryFn: ({ signal }) => api<QeetAIProviderConfig>("/v1/qeetai/provider-config", { signal }),
    staleTime: 30_000,
    retry: false,
  });
}

/** Set (or rotate) the tenant's BYOK provider key. */
export function setQeetAIProviderConfig(
  input: SetQeetAIProviderInput,
): Promise<QeetAIProviderConfig> {
  return api<QeetAIProviderConfig>("/v1/qeetai/provider-config", { method: "PUT", body: input });
}

/** Validate a provider key + endpoint with a live probe (does not save). */
export function testQeetAIProviderConfig(input: SetQeetAIProviderInput): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>("/v1/qeetai/provider-config/test", { method: "POST", body: input });
}

/** Remove the tenant's BYOK key, reverting to the platform fallback (or none). */
export function deleteQeetAIProviderConfig(): Promise<void> {
  return api<void>("/v1/qeetai/provider-config", { method: "DELETE" });
}
