import {
  Badge,
  Button,
  Checkbox,
  CheckboxGroup,
  Field,
  Radio,
  RadioGroup,
  Select,
} from "@qeetrix/react";
import { NumberField } from "@qeetrix/react/experimental";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SecurityPolicy, StepUpMethod } from "@/modules/organizations/api/security-policy";
import { errorMessage, fieldErrorMessages } from "@/platform/errors/user-message";
import { SensitiveActionCancelled } from "@/platform/security/sensitive-action-provider";
import {
  durationParts,
  isMfaMode,
  MFA_MODES,
  type MfaMode,
  STEP_UP_METHODS,
} from "./security-model";
import { Detail, EditingDetail, Failure, OpenDetail, Panel } from "./settings-parts";

export type SavePolicy = (patch: Partial<SecurityPolicy>) => Promise<unknown>;

/** Saving one rule: pending, and why it failed in safe words (a field's own message first). */
function useRuleSave(save: SavePolicy, fields: (keyof SecurityPolicy)[], onDone: () => void) {
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  return {
    saving,
    failure,
    run: async (patch: Partial<SecurityPolicy>) => {
      setSaving(true);
      setFailure(null);
      try {
        await save(patch);
        onDone();
      } catch (err) {
        if (err instanceof SensitiveActionCancelled) return;
        const byField = fieldErrorMessages(err);
        setFailure(fields.map((name) => byField[name]).find(Boolean) ?? errorMessage(err));
      } finally {
        setSaving(false);
      }
    },
  };
}

/** A duration in words: "30 days", "1 hour", "15 minutes". */
export function useDurationWords() {
  const { t } = useTranslation("organizations");
  return (minutes: number) => {
    const { unit, n } = durationParts(minutes);
    return t(`settings.security.duration.${unit}`, { count: n });
  };
}

/** A rule with one choice (a duration), changed where it sits: Select, Cancel and Save. */
export function ChoiceRule({
  label,
  hint,
  value,
  choices,
  canEdit,
  editing,
  field,
  onEdit,
  onClose,
  save,
  toPatch,
}: {
  label: string;
  hint: ReactNode;
  value: number;
  choices: number[];
  canEdit: boolean;
  editing: boolean;
  field: keyof SecurityPolicy;
  onEdit: () => void;
  onClose: () => void;
  save: SavePolicy;
  toPatch: (minutes: number) => Partial<SecurityPolicy>;
}) {
  const { t } = useTranslation("organizations");
  const words = useDurationWords();
  const [draft, setDraft] = useState(value);
  const rule = useRuleSave(save, [field], onClose);
  if (!editing)
    return (
      <Detail
        label={label}
        hint={hint}
        action={
          canEdit ? (
            <ChangeButton
              label={label}
              onClick={() => {
                setDraft(value);
                onEdit();
              }}
            />
          ) : undefined
        }
      >
        {words(value)}
      </Detail>
    );
  return (
    <EditingDetail
      label={label}
      buttons={
        <>
          <Button variant="ghost" size="lg" disabled={rule.saving} onClick={onClose}>
            {t("settings.cancel")}
          </Button>
          <Button
            size="lg"
            loading={rule.saving}
            onClick={() => (draft === value ? onClose() : void rule.run(toPatch(draft)))}
          >
            {t("settings.save")}
          </Button>
        </>
      }
    >
      <Select
        aria-label={label}
        value={draft}
        onValueChange={(next) => next !== null && setDraft(next)}
        items={choices.map((minutes) => ({ value: minutes, label: words(minutes) }))}
      />
      {rule.failure && <Failure>{rule.failure}</Failure>}
    </EditingDetail>
  );
}

export function ChangeButton({ label, onClick }: { label: string; onClick: () => void }) {
  const { t } = useTranslation("organizations");
  return (
    <Button
      variant="ghost"
      aria-label={`${t("settings.change")} ${label.toLowerCase()}`}
      onClick={onClick}
    >
      {t("settings.change")}
    </Button>
  );
}

/** Who needs two-step verification, opened under its row: three choices, and the days to set it up. */
export function MfaRuleEditor({
  saved,
  without,
  save,
  onClose,
}: {
  saved: SecurityPolicy;
  without?: number;
  save: SavePolicy;
  onClose: () => void;
}) {
  const { t } = useTranslation("organizations");
  const [mode, setMode] = useState<MfaMode>(
    isMfaMode(saved.mfa_enforcement) ? saved.mfa_enforcement : "optional",
  );
  const [days, setDays] = useState<number | null>(saved.mfa_grace_days);
  const rule = useRuleSave(save, ["mfa_enforcement", "mfa_grace_days"], onClose);
  const label = t("settings.security.mfa.who");
  return (
    <OpenDetail label={label}>
      <Panel
        title={t("settings.security.mfa.editTitle")}
        description={t("settings.security.mfa.editDescription")}
      >
        <RadioGroup
          label={label}
          variant="tile"
          value={mode}
          onValueChange={(next) => isMfaMode(String(next)) && setMode(next as MfaMode)}
        >
          {MFA_MODES.map((value) => (
            <Radio
              key={value}
              value={value}
              label={
                value === "required" ? (
                  <span className="settings-choice">
                    {t("settings.security.mfa.mode.required")}
                    <Badge tone="brand" size="sm">
                      {t("settings.security.mfa.recommended")}
                    </Badge>
                  </span>
                ) : (
                  t(`settings.security.mfa.mode.${value}`)
                )
              }
              description={
                value === "required" && without
                  ? t("settings.security.mfa.choice.requiredCount", { count: without })
                  : t(`settings.security.mfa.choice.${value}`)
              }
            />
          ))}
        </RadioGroup>
        {mode !== "optional" ? (
          <div className="account-panel-form">
            <Field
              label={t("settings.security.mfa.days")}
              description={t("settings.security.mfa.daysHint")}
            >
              <NumberField
                value={days}
                onValueChange={(next) => setDays(next)}
                min={0}
                max={90}
                endAdornment={t("settings.security.mfa.daysUnit")}
              />
            </Field>
          </div>
        ) : null}
        {rule.failure && <Failure>{rule.failure}</Failure>}
        <span className="account-panel-actions">
          <Button
            size="lg"
            loading={rule.saving}
            onClick={() =>
              void rule.run({
                mfa_enforcement: mode,
                mfa_grace_days: mode === "optional" ? saved.mfa_grace_days : (days ?? 0),
              })
            }
          >
            {t("settings.save")}
          </Button>
          <Button variant="ghost" size="lg" disabled={rule.saving} onClick={onClose}>
            {t("settings.cancel")}
          </Button>
        </span>
      </Panel>
    </OpenDetail>
  );
}

/** Sessions per person, opened under its row: the limit (none, or 1 to 1000) and what happens at it. */
export function SessionLimitEditor({
  saved,
  save,
  onClose,
}: {
  saved: SecurityPolicy;
  save: SavePolicy;
  onClose: () => void;
}) {
  const { t } = useTranslation("organizations");
  const [limit, setLimit] = useState<number | null>(saved.max_sessions);
  const [action, setAction] = useState(
    saved.session_limit_action === "refuse" ? "refuse" : "evict_oldest",
  );
  const rule = useRuleSave(save, ["max_sessions", "session_limit_action"], onClose);
  return (
    <OpenDetail label={t("settings.security.sessions.perPerson")}>
      <Panel
        title={t("settings.security.sessions.limitTitle")}
        description={t("settings.security.sessions.limitDescription")}
      >
        <div className="account-panel-form">
          <Field
            label={t("settings.security.sessions.limit")}
            description={t("settings.security.sessions.limitHint")}
          >
            <NumberField
              value={limit}
              onValueChange={(next) => setLimit(next)}
              min={1}
              max={1000}
              placeholder={t("settings.security.sessions.noLimit")}
            />
          </Field>
        </div>
        {limit !== null ? (
          <RadioGroup
            label={t("settings.security.sessions.atLimit")}
            value={action}
            onValueChange={(next) => setAction(next === "refuse" ? "refuse" : "evict_oldest")}
          >
            <Radio value="evict_oldest" label={t("settings.security.sessions.evict")} />
            <Radio value="refuse" label={t("settings.security.sessions.refuse")} />
          </RadioGroup>
        ) : null}
        {rule.failure && <Failure>{rule.failure}</Failure>}
        <span className="account-panel-actions">
          <Button
            size="lg"
            loading={rule.saving}
            onClick={() => void rule.run({ max_sessions: limit, session_limit_action: action })}
          >
            {t("settings.save")}
          </Button>
          <Button variant="ghost" size="lg" disabled={rule.saving} onClick={onClose}>
            {t("settings.cancel")}
          </Button>
        </span>
      </Panel>
    </OpenDetail>
  );
}

/** The factors that count for a second step, opened under its row; at least one stays ticked. */
export function FactorsEditor({
  saved,
  save,
  onClose,
}: {
  saved: SecurityPolicy;
  save: SavePolicy;
  onClose: () => void;
}) {
  const { t } = useTranslation("organizations");
  const [picked, setPicked] = useState<StepUpMethod[]>(saved.step_up_methods ?? STEP_UP_METHODS);
  const rule = useRuleSave(save, ["step_up_methods"], onClose);
  return (
    <OpenDetail label={t("settings.security.stepUp.factors")}>
      <Panel
        title={t("settings.security.stepUp.factorsTitle")}
        description={t("settings.security.stepUp.factorsDescription")}
      >
        <CheckboxGroup
          label={t("settings.security.stepUp.factors")}
          value={picked}
          onValueChange={(next: string[]) =>
            next.length > 0 && setPicked(STEP_UP_METHODS.filter((method) => next.includes(method)))
          }
        >
          {STEP_UP_METHODS.map((method) => (
            <Checkbox
              key={method}
              value={method}
              label={t(`settings.security.stepUp.method.${method}`)}
              disabled={picked.length === 1 && picked.includes(method)}
            />
          ))}
        </CheckboxGroup>
        {rule.failure && <Failure>{rule.failure}</Failure>}
        <span className="account-panel-actions">
          <Button
            size="lg"
            loading={rule.saving}
            onClick={() =>
              void rule.run({
                // Every type ticked is sent as null, the server's "all of them".
                step_up_methods: picked.length === STEP_UP_METHODS.length ? null : picked,
              })
            }
          >
            {t("settings.save")}
          </Button>
          <Button variant="ghost" size="lg" disabled={rule.saving} onClick={onClose}>
            {t("settings.cancel")}
          </Button>
        </span>
      </Panel>
    </OpenDetail>
  );
}
