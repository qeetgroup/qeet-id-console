import { Badge, Button, Field, Radio, RadioGroup, Text, TextField } from "@qeetrix/react";
import { Alert, NumberField, PasswordInput } from "@qeetrix/react/experimental";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  QeetAIProvider,
  QeetAIProviderConfig,
  SetQeetAIProviderInput,
} from "@/modules/qeetai/api/qeetai";
import {
  changeProvider,
  type ProviderSettingsDraft,
  type ProviderSettingsErrors,
  providerSettingsDraft,
  providerSettingsInput,
  validateProviderSettings,
} from "@/modules/qeetai/provider-settings-model";
import { errorMessage } from "@/platform/errors/user-message";
import { SensitiveActionCancelled } from "@/platform/security/sensitive-action-provider";

export type ProviderActions = {
  onSave: (input: SetQeetAIProviderInput) => Promise<QeetAIProviderConfig>;
  onTest: (input: SetQeetAIProviderInput) => Promise<{ ok: boolean }>;
};

// An example of each provider's key, for the placeholder; Azure's keys have no common shape.
const KEY_EXAMPLE: Record<QeetAIProvider, "key.exampleAnthropic" | "key.exampleOpenai" | null> = {
  anthropic: "key.exampleAnthropic",
  openai: "key.exampleOpenai",
  azure: null,
};

/**
 * Connecting a provider, or changing the one connected: which provider, its model, the key, and
 * an optional base URL and reply limit; then Test (one live request, nothing saved) or Save. The
 * key is write-only, so a change asks for it again. A test passes only for the values it tried:
 * editing anything clears it. Nothing can change while a request runs, and a result that comes
 * back after the form has closed is dropped.
 */
export function ProviderForm({
  config,
  turnsOn,
  onSave,
  onTest,
  onSaved,
  onCancel,
}: ProviderActions & {
  /** The organisation's own settings, when changing them; none when connecting. */
  config?: QeetAIProviderConfig;
  /** Whether saving turns Qeet AI on (it's off now), which the main button says. */
  turnsOn: boolean;
  onSaved: (saved: QeetAIProviderConfig) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("qeetai");
  const [draft, setDraft] = useState<ProviderSettingsDraft>(() =>
    config ? providerSettingsDraft(config) : changeProvider("anthropic"),
  );
  const [errors, setErrors] = useState<ProviderSettingsErrors>({});
  const [pending, setPending] = useState<"save" | "test" | null>(null);
  const [tested, setTested] = useState(false);
  const [failure, setFailure] = useState<{ title: string; text: string }>();
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function change(next: ProviderSettingsDraft, field: keyof ProviderSettingsDraft) {
    if (busy.current) return;
    setDraft(next);
    setTested(false);
    setFailure(undefined);
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validateField(field: keyof ProviderSettingsDraft) {
    if (busy.current) return;
    setErrors((current) => ({ ...current, [field]: validateProviderSettings(draft)[field] }));
  }

  async function perform(action: "save" | "test") {
    if (busy.current) return;
    const validation = validateProviderSettings(draft);
    setErrors(validation);
    setFailure(undefined);
    setTested(false);
    if (Object.keys(validation).length) return;
    busy.current = true;
    setPending(action);
    try {
      if (action === "test") {
        const result = await onTest(providerSettingsInput(draft));
        if (!mounted.current) return;
        if (result.ok === true) setTested(true);
        else setFailure({ title: t("form.testFailed"), text: t("form.testRefused") });
      } else {
        const saved = await onSave(providerSettingsInput(draft));
        if (mounted.current) onSaved(saved);
      }
    } catch (error) {
      if (mounted.current && !(error instanceof SensitiveActionCancelled)) {
        setFailure({
          title: t(action === "test" ? "form.testFailed" : "form.saveFailed"),
          text: errorMessage(error),
        });
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPending(null);
    }
  }

  const azure = draft.provider === "azure";
  const example = KEY_EXAMPLE[draft.provider];
  const message = (field: keyof ProviderSettingsDraft) =>
    errors[field] ? t(`validation.${errors[field]}`) : undefined;

  return (
    <form
      className="account-panel-form qai-provider-form"
      aria-label={t(config ? "form.changeTitle" : "form.connectTitle")}
      aria-busy={pending ? true : undefined}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void perform("save");
      }}
    >
      <fieldset className="qai-provider-fields" disabled={!!pending}>
        <RadioGroup<QeetAIProvider>
          label={t("form.provider")}
          variant="tile"
          columns={3}
          value={draft.provider}
          onValueChange={(value) => {
            if (value !== draft.provider) change(changeProvider(value), "provider");
          }}
        >
          <Radio
            value="anthropic"
            label={
              <span className="qai-tile-name">
                {t("providers.anthropic")}
                <Badge tone="brand" size="sm">
                  {t("form.recommended")}
                </Badge>
              </span>
            }
            description={t("form.anthropicLine")}
          />
          <Radio value="openai" label={t("providers.openai")} description={t("form.openaiLine")} />
          <Radio
            value="azure"
            label={t("providers.azureShort")}
            description={t("form.azureLine")}
          />
        </RadioGroup>
        <TextField
          label={t("form.model")}
          className="qai-mono"
          value={draft.model}
          onValueChange={(value) => change({ ...draft, model: value }, "model")}
          onBlur={() => validateField("model")}
          description={t(azure ? "form.modelAzure" : "form.modelHint")}
          error={message("model")}
          invalid={!!errors.model}
          autoComplete="off"
          spellCheck={false}
        />
        <Field
          label={t("form.key")}
          description={t("form.keyHint")}
          error={message("apiKey")}
          invalid={!!errors.apiKey}
        >
          <PasswordInput
            className="qai-mono"
            autoComplete="off"
            capsLockWarning={false}
            value={draft.apiKey}
            onValueChange={(value) => change({ ...draft, apiKey: value }, "apiKey")}
            onBlur={() => validateField("apiKey")}
            placeholder={example ? t(example) : undefined}
          />
        </Field>
        <TextField
          label={t("form.baseUrl")}
          optional={!azure}
          type="url"
          className="qai-mono"
          value={draft.baseUrl}
          onValueChange={(value) => change({ ...draft, baseUrl: value }, "baseUrl")}
          onBlur={() => validateField("baseUrl")}
          placeholder={t("form.baseUrlExample")}
          description={t(azure ? "form.baseUrlAzure" : "form.baseUrlHint")}
          error={message("baseUrl")}
          invalid={!!errors.baseUrl}
          autoComplete="off"
          spellCheck={false}
        />
        <Field
          label={t("form.replyLimit")}
          optional
          description={t("form.replyLimitHint")}
          error={message("maxTokens")}
          invalid={!!errors.maxTokens}
        >
          <NumberField
            value={draft.maxTokens.trim() ? Number(draft.maxTokens) : null}
            onValueChange={(value) =>
              change({ ...draft, maxTokens: value == null ? "" : String(value) }, "maxTokens")
            }
            min={1}
            max={200000}
            steppers={false}
            placeholder={t("form.replyLimitExample")}
            endAdornment={t("form.tokens")}
          />
        </Field>
      </fieldset>
      {tested ? (
        <Alert tone="success" announce="polite" title={t("form.testPassed")}>
          {t(turnsOn ? "form.testPassedOff" : "form.testPassedOn")}
        </Alert>
      ) : null}
      {failure ? (
        <Alert tone="danger" announce="urgent" title={failure.title}>
          {failure.text}
        </Alert>
      ) : null}
      <span className="account-panel-actions">
        <Button type="submit" size="lg" loading={pending === "save"}>
          {t(turnsOn ? "form.saveAndTurnOn" : "form.save")}
        </Button>
        <Button
          variant="soft"
          size="lg"
          loading={pending === "test"}
          onClick={() => void perform("test")}
        >
          {t("form.test")}
        </Button>
        <Button variant="ghost" size="lg" disabled={!!pending} onClick={onCancel}>
          {t("form.cancel")}
        </Button>
      </span>
      <Text size="sm" tone="subtle">
        {t("form.testNote")}
      </Text>
    </form>
  );
}
