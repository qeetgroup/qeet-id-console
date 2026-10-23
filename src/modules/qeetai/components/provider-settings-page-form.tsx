import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@qeetrix/ui";
import {
  BoxIcon,
  CircleCheckIcon,
  EllipsisVerticalIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  PlugZapIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  TrashIcon,
} from "@qeetrix/icons";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "@/platform/errors/user-message";
import { SensitiveActionCancelled } from "@/platform/security/sensitive-action-provider";
import type { QeetAIProviderConfig, SetQeetAIProviderInput } from "../api/qeetai";
import {
  providerSettingsDraft,
  providerSettingsInput,
  type ProviderSettingsDraft,
  type ProviderSettingsErrors,
  validateProviderSettings,
} from "../provider-settings-model";
import { ProviderSettingsFields } from "./provider-settings-page-fields";

export type ProviderSettingsActions = {
  onSave: (input: SetQeetAIProviderInput) => Promise<QeetAIProviderConfig>;
  onTest: (input: SetQeetAIProviderInput) => Promise<{ ok: boolean }>;
  onRemove: () => Promise<QeetAIProviderConfig | undefined>;
};

export const PANEL =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 shadow-xs dark:bg-card/70 dark:shadow-none";
const ACTION =
  "h-9 gap-2 rounded-md px-3.5 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";
const FIELDS =
  "space-y-3 **:data-[slot=field]:gap-1 **:data-[slot=field-label]:text-xs **:data-[slot=field-description]:text-[11px] **:data-[slot=field-description]:leading-4";

/**
 * Renders the provider form: a write-only key with test, save, reset and remove. Edits survive a
 * background refetch, and an action's result is ignored once the form unmounts.
 */
export function ProviderSettingsForm({
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
                  <TrashIcon /> {t("qeetAI.actions.remove")}
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
        <ProviderSettingsFields
          formId={formId}
          draft={draft}
          errors={errors}
          hasOwnKey={hasOwnKey}
          showKey={showKey}
          locked={!!pending || !canWrite}
          onChange={change}
          onValidate={validateField}
          onShowKeyChange={setShowKey}
        />

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
            <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
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
              <LoaderCircleIcon className="size-4 motion-safe:animate-spin" />
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
                <LoaderCircleIcon className="size-4 motion-safe:animate-spin" />
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
