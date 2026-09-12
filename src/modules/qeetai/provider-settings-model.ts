import type { QeetAIProvider, QeetAIProviderConfig, SetQeetAIProviderInput } from "./api/qeetai";

export const PROVIDER_OPTIONS = [
  { value: "anthropic", label: "Anthropic (Claude)", model: "claude-sonnet-5" },
  { value: "openai", label: "OpenAI", model: "gpt-4o" },
  { value: "azure", label: "Azure / OpenAI-compatible", model: "" },
] as const;

export type ProviderSettingsDraft = {
  provider: QeetAIProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: string;
};

export type ProviderSettingsErrors = Partial<
  Record<keyof ProviderSettingsDraft, "required" | "url" | "tokens">
>;

export function providerSettingsDraft(config?: QeetAIProviderConfig): ProviderSettingsDraft {
  const provider =
    PROVIDER_OPTIONS.find((option) => option.value === config?.provider) ?? PROVIDER_OPTIONS[0];
  return {
    provider: provider.value,
    model: config?.model ?? "",
    apiKey: "",
    baseUrl: config?.base_url ?? "",
    maxTokens: config?.max_tokens ? String(config.max_tokens) : "",
  };
}

export function changeProvider(provider: QeetAIProvider): ProviderSettingsDraft {
  return {
    provider,
    model: PROVIDER_OPTIONS.find((option) => option.value === provider)?.model ?? "",
    apiKey: "",
    baseUrl: "",
    maxTokens: "",
  };
}

export function validateProviderSettings(draft: ProviderSettingsDraft): ProviderSettingsErrors {
  const errors: ProviderSettingsErrors = {};
  if (!draft.model.trim()) errors.model = "required";
  if (!draft.apiKey.trim()) errors.apiKey = "required";
  if (!draft.baseUrl.trim() && draft.provider === "azure") errors.baseUrl = "required";
  if (draft.baseUrl.trim()) {
    try {
      const endpoint = new URL(draft.baseUrl.trim());
      if (
        !["https:", "http:"].includes(endpoint.protocol) ||
        endpoint.username ||
        endpoint.password
      ) {
        errors.baseUrl = "url";
      }
    } catch {
      errors.baseUrl = "url";
    }
  }
  if (draft.maxTokens.trim()) {
    const tokens = Number(draft.maxTokens);
    if (!Number.isInteger(tokens) || tokens < 1 || tokens > 200000) errors.maxTokens = "tokens";
  }
  return errors;
}

export function providerSettingsInput(draft: ProviderSettingsDraft): SetQeetAIProviderInput {
  return {
    provider: draft.provider,
    model: draft.model.trim(),
    api_key: draft.apiKey.trim(),
    base_url: draft.baseUrl.trim() || undefined,
    max_tokens: draft.maxTokens.trim() ? Number(draft.maxTokens) : undefined,
  };
}
