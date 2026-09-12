import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@qeetrix/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  BoxIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  EyeOffIcon,
  HashIcon,
  KeyRoundIcon,
  LinkIcon,
  Loader2Icon,
  LockKeyholeIcon,
  PlugZapIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useTenantId } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  deleteQeetAIProviderConfig,
  QEETAI_PROVIDER_CONFIG_KEY,
  QEETAI_STATUS_KEY,
  type QeetAIProviderConfig,
  type SetQeetAIProviderInput,
  setQeetAIProviderConfig,
  testQeetAIProviderConfig,
  useQeetAIProviderConfig,
} from "../api/qeetai";
import {
  changeProvider,
  PROVIDER_OPTIONS,
  providerSettingsDraft,
  providerSettingsInput,
  type ProviderSettingsDraft,
  type ProviderSettingsErrors,
  validateProviderSettings,
} from "../provider-settings-model";
import { ProviderLogo, ProviderSettingsGuidance } from "./provider-settings-guidance";

type ProviderSettingsActions = {
  onSave: (input: SetQeetAIProviderInput) => Promise<QeetAIProviderConfig>;
  onTest: (input: SetQeetAIProviderInput) => Promise<{ ok: boolean }>;
  onRemove: () => Promise<QeetAIProviderConfig | undefined>;
};

export type ProviderSettingsViewProps = ProviderSettingsActions & {
  config?: QeetAIProviderConfig;
  loading: boolean;
  error: boolean;
  fetching: boolean;
  canRead: boolean;
  canWrite: boolean;
  onRetry: () => unknown;
};

const PANEL =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 shadow-xs dark:bg-card/70 dark:shadow-none";
const INPUT = "h-8 rounded-md bg-muted/15 text-xs pointer-coarse:min-h-11 pointer-coarse:text-base";
const ACTION =
  "h-9 gap-2 rounded-md px-3.5 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";
const FIELDS =
  "space-y-3 **:data-[slot=field]:gap-1 **:data-[slot=field-label]:text-xs **:data-[slot=field-description]:text-[11px] **:data-[slot=field-description]:leading-4";

export function QeetAISettingsPage() {
  const { t } = useTranslation("settings");
  const tenantId = useTenantId();
  const access = useCapabilities();
  const canRead = !!tenantId && access.state === "ready" && access.can("secret.read");
  const canWrite = canRead && access.can("secret.write");
  const configQuery = useQeetAIProviderConfig(canRead);
  const queryClient = useQueryClient();
  const sensitive = useSensitiveAction();
  const queryKey = [...QEETAI_PROVIDER_CONFIG_KEY, tenantId];
  const activeTenant = useRef(tenantId);

  useEffect(() => {
    activeTenant.current = tenantId;
    return () => {
      activeTenant.current = null;
    };
  }, [tenantId]);

  function requireCurrentTenant() {
    if (!tenantId || activeTenant.current !== tenantId) throw new SensitiveActionCancelled();
  }

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QEETAI_PROVIDER_CONFIG_KEY }),
      queryClient.invalidateQueries({ queryKey: QEETAI_STATUS_KEY }),
    ]);
  };

  return (
    <ProviderSettingsView
      key={`${tenantId}:${canWrite}`}
      config={canRead ? configQuery.data : undefined}
      loading={access.state === "resolving" || (canRead && configQuery.isPending)}
      error={canRead && configQuery.isError}
      fetching={canRead && configQuery.isFetching}
      canRead={canRead}
      canWrite={canWrite}
      onRetry={configQuery.refetch}
      onSave={async (input) => {
        const result = await sensitive({
          capability: "secret.write",
          actionLabel: t("qeetAI.actions.save"),
          run: () => {
            requireCurrentTenant();
            return setQeetAIProviderConfig(input);
          },
        });
        if (!result) throw new SensitiveActionCancelled();
        queryClient.setQueryData(queryKey, result);
        await refresh();
        return result;
      }}
      onTest={async (input) => {
        const result = await sensitive({
          capability: "secret.write",
          actionLabel: t("qeetAI.actions.test"),
          run: () => {
            requireCurrentTenant();
            return testQeetAIProviderConfig(input);
          },
        });
        if (!result) throw new SensitiveActionCancelled();
        return result;
      }}
      onRemove={async () => {
        await sensitive({
          capability: "secret.write",
          actionLabel: t("qeetAI.actions.remove"),
          confirm: {
            title: t("qeetAI.remove.title"),
            description: t(
              configQuery.data?.platform_fallback
                ? "qeetAI.remove.fallback"
                : "qeetAI.remove.unavailable",
            ),
            confirmLabel: t("qeetAI.actions.remove"),
            tone: "destructive",
          },
          run: () => {
            requireCurrentTenant();
            return deleteQeetAIProviderConfig();
          },
        });
        await refresh();
        return queryClient.getQueryData<QeetAIProviderConfig>(queryKey);
      }}
    />
  );
}

export function ProviderSettingsView(props: ProviderSettingsViewProps) {
  const { t } = useTranslation("settings");
  const configuration = !props.error && props.canRead ? props.config : undefined;

  return (
    <div className="@container/ai-settings relative isolate flex min-w-0 flex-col gap-4 before:pointer-events-none before:absolute before:-inset-4 before:-z-10 before:bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] before:bg-size-[32px_32px] before:opacity-10 dark:before:opacity-5">
      <header className="relative flex min-h-20 items-start justify-between gap-4 py-1">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
            <WandSparklesIcon className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-[30px] leading-9 font-semibold">
              {t("qeetAI.title")}
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">
              {t("qeetAI.description")}
            </p>
          </div>
        </div>
        <div className="pointer-events-none hidden shrink-0 items-center gap-5 text-primary @min-[980px]/ai-settings:flex">
          <BoxIcon className="size-19 text-primary/20" strokeWidth={0.6} aria-hidden="true" />
          <p className="pe-4 text-xs leading-5">
            {t("qeetAI.tagline.data")}
            <br />
            {t("qeetAI.tagline.ai")}
            <br />
            {t("qeetAI.tagline.control")}
          </p>
        </div>
      </header>

      <div className="grid items-start gap-4 @min-[820px]/ai-settings:grid-cols-[minmax(0,1.95fr)_minmax(17rem,1fr)]">
        {props.loading ? (
          <section
            role="status"
            aria-label={t("qeetAI.loading")}
            className={cn(PANEL, "space-y-6 p-5")}
          >
            <Skeleton className="h-10 w-3/4" />
            {["provider", "key", "url", "tokens"].map((field) => (
              <Skeleton key={field} className="h-16 w-full" />
            ))}
            <Skeleton className="h-9 w-full" />
          </section>
        ) : !props.canRead || props.error || !configuration ? (
          <section
            className={cn(
              PANEL,
              "grid min-h-80 place-content-center justify-items-center gap-3 p-6 text-center",
            )}
          >
            <ShieldCheckIcon className="size-8 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-heading text-base font-semibold">
              {t(props.canRead ? "qeetAI.loadError" : "qeetAI.noAccess")}
            </h2>
            {props.canRead ? (
              <Button
                variant="outline"
                size="sm"
                disabled={props.fetching}
                onClick={() => void props.onRetry()}
              >
                <RefreshCwIcon />
                {t("qeetAI.retry")}
              </Button>
            ) : null}
          </section>
        ) : (
          <ProviderSettingsForm
            config={configuration}
            canWrite={props.canWrite}
            onSave={props.onSave}
            onTest={props.onTest}
            onRemove={props.onRemove}
          />
        )}
        <ProviderSettingsGuidance fallback={configuration?.platform_fallback} />
      </div>
    </div>
  );
}

function ProviderSettingsForm({
  config,
  canWrite,
  onSave,
  onTest,
  onRemove,
}: ProviderSettingsActions & {
  config: QeetAIProviderConfig;
  canWrite: boolean;
}) {
  const { t } = useTranslation("settings");
  const formId = useId();
  const [draft, setDraft] = useState(() => providerSettingsDraft(config));
  const [showKey, setShowKey] = useState(false);
  const [pending, setPending] = useState<"save" | "test" | "remove" | null>(null);
  const [feedback, setFeedback] = useState<"tested" | "saved" | "removed" | null>(null);
  const [failure, setFailure] = useState<string>();
  const [errors, setErrors] = useState<ProviderSettingsErrors>({});
  const dirty = useRef(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const hasOwnKey = config.source === "tenant";
  const provider =
    PROVIDER_OPTIONS.find((option) => option.value === draft.provider) ?? PROVIDER_OPTIONS[0];
  const invalid = Object.keys(validateProviderSettings(draft)).length > 0;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!dirty.current) setDraft(providerSettingsDraft(config));
  }, [config]);

  function change(next: ProviderSettingsDraft) {
    if (!canWrite || busy.current) return;
    dirty.current = true;
    setDraft(next);
    setFeedback(null);
    setFailure(undefined);
    setErrors({});
  }

  function reset() {
    if (busy.current) return;
    dirty.current = false;
    setDraft(providerSettingsDraft(config));
    setShowKey(false);
    setFeedback(null);
    setFailure(undefined);
    setErrors({});
  }

  function validateField(field: keyof ProviderSettingsDraft) {
    if (!canWrite || busy.current) return;
    setErrors((current) => ({ ...current, [field]: validateProviderSettings(draft)[field] }));
  }

  async function perform(action: "save" | "test" | "remove") {
    if (!canWrite || busy.current) return;
    const validation = action === "remove" ? {} : validateProviderSettings(draft);
    setErrors(validation);
    setFailure(undefined);
    setFeedback(null);
    if (Object.keys(validation).length) return;
    busy.current = true;
    setPending(action);
    try {
      if (action === "test") {
        const result = await onTest(providerSettingsInput(draft));
        if (!mounted.current) return;
        if (result.ok === true) setFeedback("tested");
        else setFailure(t("qeetAI.feedback.testFailed"));
      } else {
        const saved =
          action === "save" ? await onSave(providerSettingsInput(draft)) : await onRemove();
        if (!mounted.current) return;
        dirty.current = false;
        setDraft(providerSettingsDraft(saved));
        setShowKey(false);
        setFeedback(action === "save" ? "saved" : "removed");
      }
    } catch (error) {
      if (mounted.current && !(error instanceof SensitiveActionCancelled)) {
        setFailure(errorMessage(error));
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPending(null);
    }
  }

  const fieldError = (field: keyof ProviderSettingsDraft) =>
    errors[field] ? (
      <FieldError id={`${formId}-${field}-error`}>
        {t(`qeetAI.validation.${errors[field]}`)}
      </FieldError>
    ) : null;

  return (
    <form
      className={cn(PANEL, "@container/ai-form px-4 pt-4 pb-3")}
      aria-label={t("qeetAI.configuration.title")}
      aria-busy={!!pending}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void perform("save");
      }}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/8 text-primary">
            <BoxIcon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-sm font-semibold">
              {t("qeetAI.configuration.title")}
            </h2>
            <p className="mt-1 max-w-md text-[11px] leading-4 text-muted-foreground">
              {t("qeetAI.configuration.description")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-end">
            <span
              className={cn(
                "inline-flex min-h-6 items-center gap-1.5 rounded-md border px-2 text-[10px] font-medium",
                hasOwnKey
                  ? "border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-border bg-muted/50 text-muted-foreground",
              )}
            >
              <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
              {t(`qeetAI.source.${config.source}`)}
            </span>
            {hasOwnKey && config.last4 ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {t("qeetAI.key.last4", { last4: config.last4 })}
              </p>
            ) : null}
          </div>
          {hasOwnKey && canWrite ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={!!pending}
                    aria-label={t("qeetAI.actions.menu")}
                    title={t("qeetAI.actions.menu")}
                  />
                }
              >
                <EllipsisVerticalIcon className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void perform("remove")}>
                  <Trash2Icon /> {t("qeetAI.actions.remove")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </header>

      {!canWrite ? (
        <p className="mb-4 text-xs text-muted-foreground">{t("qeetAI.readOnly")}</p>
      ) : null}
      <fieldset disabled={!!pending || !canWrite} className={FIELDS}>
        <div className="grid gap-4 @min-[480px]/ai-form:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${formId}-provider`}>{t("qeetAI.provider.label")}</FieldLabel>
            <Select
              value={draft.provider}
              disabled={!!pending || !canWrite}
              onValueChange={(value) => {
                const next = PROVIDER_OPTIONS.find((option) => option.value === value);
                if (!next || next.value === draft.provider) return;
                change(changeProvider(next.value));
                setShowKey(false);
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
                    {option.label}
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
                onChange={(event) => change({ ...draft, model: event.target.value })}
                onBlur={() => validateField("model")}
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
              onChange={(event) => change({ ...draft, apiKey: event.target.value })}
              onBlur={() => validateField("apiKey")}
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
                    disabled={!draft.apiKey || !!pending || !canWrite}
                    onClick={() => setShowKey(!showKey)}
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
              onChange={(event) => change({ ...draft, baseUrl: event.target.value })}
              onBlur={() => validateField("baseUrl")}
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
              onChange={(event) => change({ ...draft, maxTokens: event.target.value })}
              onBlur={() => validateField("maxTokens")}
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

        <div className="flex items-start gap-3 border-y border-border/70 bg-muted/20 px-3 py-2.5">
          <ShieldCheckIcon
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs font-medium">{t("qeetAI.encrypted.title")}</p>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
              {t("qeetAI.encrypted.description")}
            </p>
          </div>
        </div>

        {failure ? (
          <p role="alert" className="text-xs leading-5 text-destructive">
            {failure}
          </p>
        ) : null}
        {feedback ? (
          <p
            role="status"
            className="flex items-start gap-2 text-xs leading-5 text-emerald-700 dark:text-emerald-400"
          >
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t(`qeetAI.feedback.${feedback}`)}
          </p>
        ) : null}
        <footer className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            className={ACTION}
            onClick={() => void perform("test")}
            disabled={!!pending || !canWrite || invalid}
          >
            {pending === "test" ? (
              <Loader2Icon className="size-4 motion-safe:animate-spin" />
            ) : (
              <PlugZapIcon className="size-4" />
            )}
            {t(pending === "test" ? "qeetAI.actions.testing" : "qeetAI.actions.test")}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className={ACTION}
              onClick={reset}
              disabled={!!pending || !canWrite}
            >
              <RotateCcwIcon className="size-3.5" /> {t("qeetAI.actions.reset")}
            </Button>
            <Button type="submit" className={ACTION} disabled={!!pending || !canWrite || invalid}>
              {pending === "save" ? (
                <Loader2Icon className="size-4 motion-safe:animate-spin" />
              ) : (
                <KeyRoundIcon className="size-4" />
              )}
              {t(pending === "save" ? "qeetAI.actions.saving" : "qeetAI.actions.save")}
            </Button>
          </div>
        </footer>
      </fieldset>
    </form>
  );
}
