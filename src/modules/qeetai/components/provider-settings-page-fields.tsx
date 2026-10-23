import {
  Button,
  cn,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@qeetrix/ui";
import {
  ChevronDownIcon,
  EyeIcon,
  EyeOffIcon,
  HashIcon,
  LinkIcon,
  LockKeyholeIcon,
} from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import {
  changeProvider,
  PROVIDER_OPTIONS,
  type ProviderSettingsDraft,
  type ProviderSettingsErrors,
} from "../provider-settings-model";
import { ProviderLogo } from "./provider-settings-guidance";

const INPUT = "h-8 rounded-md bg-muted/15 text-xs pointer-coarse:min-h-11 pointer-coarse:text-base";

/** Renders the provider form's inputs: provider, model, API key, base URL and output limit. */
export function ProviderSettingsFields({
  formId,
  draft,
  errors,
  hasOwnKey,
  showKey,
  locked,
  onChange,
  onValidate,
  onShowKeyChange,
}: {
  formId: string;
  draft: ProviderSettingsDraft;
  errors: ProviderSettingsErrors;
  hasOwnKey: boolean;
  showKey: boolean;
  /** True while an action runs or for a read-only viewer. */
  locked: boolean;
  onChange: (next: ProviderSettingsDraft) => void;
  onValidate: (field: keyof ProviderSettingsDraft) => void;
  onShowKeyChange: (show: boolean) => void;
}) {
  const { t } = useTranslation("settings");
  const provider =
    PROVIDER_OPTIONS.find((option) => option.value === draft.provider) ?? PROVIDER_OPTIONS[0];

  const fieldError = (field: keyof ProviderSettingsDraft) =>
    errors[field] ? (
      <FieldError id={`${formId}-${field}-error`}>
        {t(`qeetAI.validation.${errors[field]}`)}
      </FieldError>
    ) : null;

  return (
    <>
      <div className="grid gap-4 @min-[480px]/ai-form:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${formId}-provider`}>{t("qeetAI.provider.label")}</FieldLabel>
          <Select
            value={draft.provider}
            disabled={locked}
            onValueChange={(value) => {
              const next = PROVIDER_OPTIONS.find((option) => option.value === value);
              if (!next || next.value === draft.provider) return;
              onChange(changeProvider(next.value));
              onShowKeyChange(false);
            }}
          >
            <SelectTrigger
              id={`${formId}-provider`}
              className={cn(INPUT, "w-full")}
              aria-describedby={`${formId}-provider-hint`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <ProviderLogo provider={option.value} />
                  {t(option.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription id={`${formId}-provider-hint`}>
            {t(`qeetAI.provider.${draft.provider}`)}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${formId}-model`}>{t("qeetAI.model.label")}</FieldLabel>
          <div className="relative">
            <Input
              id={`${formId}-model`}
              value={draft.model}
              onChange={(event) => onChange({ ...draft, model: event.target.value })}
              onBlur={() => onValidate("model")}
              className={cn(INPUT, "pe-8 font-mono")}
              list={`${formId}-models`}
              placeholder={provider.model || t("qeetAI.model.placeholder")}
              required
              autoComplete="off"
              aria-invalid={!!errors.model}
              aria-describedby={`${formId}-model-hint${errors.model ? ` ${formId}-model-error` : ""}`}
            />
            <ChevronDownIcon
              className="pointer-events-none absolute inset-e-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <datalist id={`${formId}-models`}>
              {provider.model ? <option value={provider.model} /> : null}
            </datalist>
          </div>
          <FieldDescription id={`${formId}-model-hint`}>
            {t(draft.provider === "azure" ? "qeetAI.model.azure" : "qeetAI.model.hint")}
          </FieldDescription>
          {fieldError("model")}
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor={`${formId}-apiKey`}>{t("qeetAI.key.label")}</FieldLabel>
        <div className="relative">
          <LockKeyholeIcon
            className="pointer-events-none absolute inset-s-3 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={`${formId}-apiKey`}
            type={showKey ? "text" : "password"}
            value={draft.apiKey}
            onChange={(event) => onChange({ ...draft, apiKey: event.target.value })}
            onBlur={() => onValidate("apiKey")}
            className={cn(INPUT, "ps-9 pe-10 font-mono")}
            placeholder={hasOwnKey ? t("qeetAI.key.stored") : t("qeetAI.key.placeholder")}
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={!!errors.apiKey}
            aria-describedby={`${formId}-apiKey-hint${errors.apiKey ? ` ${formId}-apiKey-error` : ""}`}
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute inset-e-1 top-1/2 size-6 -translate-y-1/2"
                  disabled={!draft.apiKey || locked}
                  onClick={() => onShowKeyChange(!showKey)}
                  aria-label={t(showKey ? "qeetAI.key.hide" : "qeetAI.key.show")}
                  aria-pressed={showKey}
                />
              }
            >
              {showKey ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
            </TooltipTrigger>
            <TooltipContent>{t(showKey ? "qeetAI.key.hide" : "qeetAI.key.show")}</TooltipContent>
          </Tooltip>
        </div>
        <FieldDescription id={`${formId}-apiKey-hint`}>{t("qeetAI.key.hint")}</FieldDescription>
        {fieldError("apiKey")}
      </Field>

      <Field>
        <FieldLabel htmlFor={`${formId}-baseUrl`}>
          {t("qeetAI.endpoint.label")}{" "}
          <span className="font-normal text-muted-foreground">
            {t(draft.provider === "azure" ? "qeetAI.required" : "qeetAI.optional")}
          </span>
        </FieldLabel>
        <div className="relative">
          <LinkIcon
            className="pointer-events-none absolute inset-s-3 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={`${formId}-baseUrl`}
            type="url"
            value={draft.baseUrl}
            className={cn(INPUT, "ps-9 font-mono")}
            onChange={(event) => onChange({ ...draft, baseUrl: event.target.value })}
            onBlur={() => onValidate("baseUrl")}
            placeholder="https://your-endpoint.example.com"
            required={draft.provider === "azure"}
            autoComplete="off"
            aria-invalid={!!errors.baseUrl}
            aria-describedby={`${formId}-baseUrl-hint${errors.baseUrl ? ` ${formId}-baseUrl-error` : ""}`}
          />
        </div>
        <FieldDescription id={`${formId}-baseUrl-hint`}>
          {t("qeetAI.endpoint.hint")}
        </FieldDescription>
        {fieldError("baseUrl")}
      </Field>

      <Field>
        <FieldLabel htmlFor={`${formId}-maxTokens`}>
          {t("qeetAI.tokens.label")}{" "}
          <span className="font-normal text-muted-foreground">{t("qeetAI.optional")}</span>
        </FieldLabel>
        <div className="relative">
          <HashIcon
            className="pointer-events-none absolute inset-s-3 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={`${formId}-maxTokens`}
            type="number"
            min={1}
            max={200000}
            step={1}
            value={draft.maxTokens}
            className={cn(INPUT, "ps-9 font-mono")}
            onChange={(event) => onChange({ ...draft, maxTokens: event.target.value })}
            onBlur={() => onValidate("maxTokens")}
            placeholder="4096"
            aria-invalid={!!errors.maxTokens}
            aria-describedby={`${formId}-maxTokens-hint${errors.maxTokens ? ` ${formId}-maxTokens-error` : ""}`}
          />
        </div>
        <FieldDescription id={`${formId}-maxTokens-hint`}>
          {t("qeetAI.tokens.hint")}
        </FieldDescription>
        {fieldError("maxTokens")}
      </Field>
    </>
  );
}
