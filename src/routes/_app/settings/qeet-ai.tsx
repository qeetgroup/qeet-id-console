import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
} from "@qeetrix/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckIcon,
  KeyRoundIcon,
  Loader2Icon,
  PlugZapIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/platform/components/page-header";
import type { ApiError } from "@/platform/errors/api-error";
import { normalizeError } from "@/platform/errors/normalize-error";
import { userMessageForCode } from "@/platform/errors/user-message";
import {
  deleteQeetAIProviderConfig,
  QEETAI_PROVIDER_CONFIG_KEY,
  QEETAI_STATUS_KEY,
  type QeetAIProvider,
  setQeetAIProviderConfig,
  testQeetAIProviderConfig,
  useQeetAIProviderConfig,
} from "@/modules/qeetai/api/qeetai";

export const Route = createFileRoute("/_app/settings/qeet-ai")({
  component: QeetAISettingsPage,
});

const PROVIDERS: { value: QeetAIProvider; label: string; defaultModel: string; hint: string }[] = [
  {
    value: "anthropic",
    label: "Anthropic (Claude)",
    defaultModel: "claude-sonnet-5",
    hint: "Uses api.anthropic.com unless you set a custom base URL.",
  },
  {
    value: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o",
    hint: "Uses api.openai.com/v1, or any OpenAI-compatible endpoint via base URL.",
  },
  {
    value: "azure",
    label: "Azure / OpenAI-compatible",
    defaultModel: "",
    hint: "Requires a base URL pointing at your OpenAI-compatible endpoint.",
  },
];

function sourceBadge(source: string | undefined) {
  switch (source) {
    case "tenant":
      return <Badge variant="default">Your key</Badge>;
    case "platform":
      return <Badge variant="secondary">Qeet-managed</Badge>;
    default:
      return <Badge variant="outline">Not configured</Badge>;
  }
}

function QeetAISettingsPage() {
  const qc = useQueryClient();
  const configQ = useQeetAIProviderConfig();

  const [provider, setProvider] = useState<QeetAIProvider>("anthropic");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [testResult, setTestResult] = useState<"ok" | null>(null);

  // Hydrate the form from the current (masked) config once it loads.
  useEffect(() => {
    const c = configQ.data;
    if (!c) return;
    const p = (["anthropic", "openai", "azure"] as const).includes(c.provider as QeetAIProvider)
      ? (c.provider as QeetAIProvider)
      : "anthropic";
    setProvider(p);
    setModel(c.model ?? "");
    setBaseUrl(c.base_url ?? "");
    setMaxTokens(c.max_tokens ? String(c.max_tokens) : "");
  }, [configQ.data]);

  const config = configQ.data;
  const hasOwnKey = config?.source === "tenant";

  function currentInput() {
    return {
      provider,
      model: model.trim(),
      api_key: apiKey,
      base_url: baseUrl.trim() || undefined,
      max_tokens: maxTokens ? Number(maxTokens) : undefined,
    };
  }

  const testM = useMutation({
    mutationFn: () => testQeetAIProviderConfig(currentInput()),
    onSuccess: () => setTestResult("ok"),
  });

  const saveM = useMutation({
    mutationFn: () => setQeetAIProviderConfig(currentInput()),
    onSuccess: () => {
      setApiKey("");
      setTestResult(null);
      qc.invalidateQueries({ queryKey: QEETAI_PROVIDER_CONFIG_KEY });
      qc.invalidateQueries({ queryKey: QEETAI_STATUS_KEY });
    },
  });

  const removeM = useMutation({
    mutationFn: () => deleteQeetAIProviderConfig(),
    onSuccess: () => {
      setApiKey("");
      setTestResult(null);
      qc.invalidateQueries({ queryKey: QEETAI_PROVIDER_CONFIG_KEY });
      qc.invalidateQueries({ queryKey: QEETAI_STATUS_KEY });
    },
  });

  const activeProvider = PROVIDERS.find((p) => p.value === provider);
  const keyPlaceholder = hasOwnKey && config?.last4 ? `Stored — ends in …${config.last4}` : "sk-…";
  const mutating = testM.isPending || saveM.isPending || removeM.isPending;
  const actionError = (testM.error ?? saveM.error ?? removeM.error) as ApiError | undefined;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description="Connect your own AI provider so Qeet AI runs on your account instead of Qeet's — bringing your own key unlocks the assistant on any plan." />

      <Alert>
        <SparklesIcon />
        <AlertDescription>
          When your organization sets a provider key here, every member's Qeet AI uses it. Leave it
          empty to use the Qeet-managed model (subject to your plan). Your key is encrypted at rest
          and never shown again after saving.
        </AlertDescription>
      </Alert>

      {configQ.isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveM.mutate();
          }}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">AI provider</CardTitle>
                      <CardDescription>
                        Choose a provider and paste an API key from your own account.
                      </CardDescription>
                    </div>
                    {sourceBadge(config?.source)}
                  </div>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <Field className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="provider">Provider</FieldLabel>
                        <Select
                          value={provider}
                          onValueChange={(v) => {
                            if (!v) return;
                            const next = v as QeetAIProvider;
                            setProvider(next);
                            // Prefill a sensible default model when switching.
                            const def = PROVIDERS.find((p) => p.value === next)?.defaultModel ?? "";
                            if (def) setModel(def);
                            setTestResult(null);
                          }}
                        >
                          <SelectTrigger id="provider">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROVIDERS.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldDescription>{activeProvider?.hint}</FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="model">Model</FieldLabel>
                        <Input
                          id="model"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          placeholder={activeProvider?.defaultModel || "deployment / model id"}
                          className="font-mono"
                          required
                        />
                        <FieldDescription>
                          {provider === "azure"
                            ? "Your Azure deployment name."
                            : "The model id to use for this organization."}
                        </FieldDescription>
                      </Field>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="apiKey">API key</FieldLabel>
                      <Input
                        id="apiKey"
                        type="password"
                        autoComplete="off"
                        value={apiKey}
                        onChange={(e) => {
                          setApiKey(e.target.value);
                          setTestResult(null);
                        }}
                        placeholder={keyPlaceholder}
                      />
                      <FieldDescription>
                        Write-only — re-enter your key to save changes or rotate it. It's encrypted
                        at rest and never returned.
                      </FieldDescription>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="baseUrl">
                        Base URL{" "}
                        <span className="text-muted-foreground">
                          {provider === "azure" ? "(required)" : "(optional)"}
                        </span>
                      </FieldLabel>
                      <Input
                        id="baseUrl"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="https://your-endpoint.example.com"
                        className="font-mono"
                      />
                      <FieldDescription>
                        Point at a self-hosted, gateway, or Azure OpenAI-compatible endpoint.
                      </FieldDescription>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="maxTokens">
                        Max output tokens <span className="text-muted-foreground">(optional)</span>
                      </FieldLabel>
                      <Input
                        id="maxTokens"
                        type="number"
                        min={1}
                        max={200000}
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(e.target.value)}
                        placeholder="4096"
                      />
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>

              {actionError && (
                <Card className="border-destructive">
                  <CardContent className="p-4">
                    <FieldError>
                      {userMessageForCode(
                        normalizeError(actionError).code,
                        normalizeError(actionError).kind,
                      )}
                    </FieldError>
                  </CardContent>
                </Card>
              )}
              {testResult === "ok" && !actionError && (
                <Alert>
                  <CheckIcon />
                  <AlertDescription>
                    Connection verified — the key and endpoint work. Save to apply it.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => testM.mutate()}
                  disabled={mutating || !apiKey || !model.trim()}
                >
                  {testM.isPending ? <Loader2Icon className="animate-spin" /> : <PlugZapIcon />}
                  Test connection
                </Button>
                <div className="flex gap-2">
                  {hasOwnKey && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeM.mutate()}
                      disabled={mutating}
                    >
                      {removeM.isPending ? (
                        <Loader2Icon className="animate-spin" />
                      ) : (
                        <Trash2Icon />
                      )}
                      Remove key
                    </Button>
                  )}
                  <Button type="submit" disabled={mutating || !apiKey || !model.trim()}>
                    {saveM.isPending ? <Loader2Icon className="animate-spin" /> : <KeyRoundIcon />}
                    {hasOwnKey ? "Update key" : "Save key"}
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">How it works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Bring your own key.</span>{" "}
                    Inference runs on your provider account, so premium models are billed to you —
                    not Qeet.
                  </p>
                  <Separator />
                  <p>
                    <span className="font-medium text-foreground">Any plan.</span> A configured key
                    enables Qeet AI regardless of your Qeet ID plan.
                  </p>
                  <Separator />
                  <p>
                    <span className="font-medium text-foreground">Fallback.</span>{" "}
                    {config?.platform_fallback
                      ? "Remove your key to fall back to the Qeet-managed model."
                      : "No Qeet-managed model is available on this deployment — a key is required to use Qeet AI."}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
