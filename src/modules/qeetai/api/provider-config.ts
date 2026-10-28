// The writes behind Settings › Qeet AI, apart from qeetai.ts, which the shell carries through the
// barrel. The server requires secret.write, and a step-up to save or remove a key.

import { api } from "@/platform/api/client";
import type { QeetAIProviderConfig, SetQeetAIProviderInput } from "./qeetai";

/** Sets or replaces the organisation's own provider key; the reply never holds the key. */
export function setQeetAIProviderConfig(
  input: SetQeetAIProviderInput,
): Promise<QeetAIProviderConfig> {
  return api<QeetAIProviderConfig>("/v1/qeetai/provider-config", { method: "PUT", body: input });
}

/** Checks a key, model and endpoint with one live request to the provider, without saving. */
export function testQeetAIProviderConfig(input: SetQeetAIProviderInput): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>("/v1/qeetai/provider-config/test", { method: "POST", body: input });
}

/** Removes the organisation's own key: Qeet AI falls back to the Qeet-managed key, if any. */
export function deleteQeetAIProviderConfig(): Promise<void> {
  return api<void>("/v1/qeetai/provider-config", { method: "DELETE" });
}
