// The writes behind Settings › Qeet AI, apart from qeetai.ts, which the shell carries through the
// barrel. The server requires secret.write, and a step-up to save or remove a key.
import type { QeetAIProviderConfig, SetQeetAIProviderInput } from "./qeetai";
import { backend } from "@/platform/api/backend";

/** Sets or replaces the organisation's own provider key; the reply never holds the key. */
export function setQeetAIProviderConfig(
  input: SetQeetAIProviderInput,
): Promise<QeetAIProviderConfig> {
  return backend.put("/v1/qeetai/provider-config", { body: input });
}

/** Checks a key, model and endpoint with one live request to the provider, without saving. */
export function testQeetAIProviderConfig(input: SetQeetAIProviderInput): Promise<{ ok: boolean }> {
  return backend.post("/v1/qeetai/provider-config/test", { body: input });
}

/** Removes the organisation's own key: Qeet AI falls back to the Qeet-managed key, if any. */
export function deleteQeetAIProviderConfig(): Promise<void> {
  return backend.delete("/v1/qeetai/provider-config");
}
