import { Badge, Button, formatNumber } from "@qeetrix/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { formatLocale } from "@/i18n";
import type { AuthPolicy, LockoutSettings } from "@/modules/authentication/api/auth-policy";
import { applyServerErrors, useAppForm } from "@/platform/forms/app-form";
import { settleSensitiveAction } from "@/platform/security/sensitive-action-provider";
import { Detail, Failure, Panel, Section } from "./methods-parts";
import { useSavePolicy } from "./use-policy";

/* ── Lockout after wrong passwords ────────────────────────────────────────── */

const LOCKOUT = [
  { key: "lockout_threshold", limit: "threshold", copy: "threshold" },
  { key: "lockout_window_minutes", limit: "window_minutes", copy: "window" },
  { key: "lockout_duration_minutes", limit: "duration_minutes", copy: "duration" },
] as const satisfies readonly {
  key: keyof AuthPolicy;
  limit: keyof LockoutSettings;
  copy: string;
}[];

/**
 * The lockout after wrong passwords (the server's per-account, per-network lockout): each setting
 * the organisation chose, or the platform default; the three are changed together.
 */
export function LockoutSection({
  policy,
  limits,
  canWrite,
}: {
  policy: AuthPolicy;
  limits: NonNullable<AuthPolicy["lockout_limits"]>;
  canWrite: boolean;
}) {
  const { t } = useTranslation("authentication");
  const [editing, setEditing] = useState(false);
  const locale = formatLocale();
  return (
    <Section
      title={t("password.lockoutTitle")}
      description={t("password.lockoutDescription")}
      action={
        canWrite &&
        !editing && (
          <Button
            variant="ghost"
            className="am-head-action"
            aria-label={t("password.editLockout")}
            onClick={() => setEditing(true)}
          >
            {t("methods.edit")}
          </Button>
        )
      }
    >
      {editing ? (
        <LockoutPanel policy={policy} limits={limits} onDone={() => setEditing(false)} />
      ) : (
        <dl className="account-details">
          {LOCKOUT.map((f) => {
            const value = policy[f.key];
            const shown = value ?? limits.defaults[f.limit];
            return (
              <Detail
                key={f.key}
                label={t(`password.lockout.${f.copy}.label`)}
                hint={f.copy === "window" ? t("password.lockout.window.hint") : undefined}
              >
                <span className="am-value">
                  {f.copy === "threshold"
                    ? formatNumber(shown, locale)
                    : t("password.minutes", { count: shown })}
                  {value === null && <Badge size="sm">{t("password.lockout.default")}</Badge>}
                </span>
              </Detail>
            );
          })}
        </dl>
      )}
    </Section>
  );
}

type LockoutValues = Record<(typeof LOCKOUT)[number]["key"], number | null>;

/** The lockout's three numbers, changed together; an empty one takes the platform default. */
function LockoutPanel({
  policy,
  limits,
  onDone,
}: {
  policy: AuthPolicy;
  limits: NonNullable<AuthPolicy["lockout_limits"]>;
  onDone: () => void;
}) {
  const { t } = useTranslation("authentication");
  const save = useSavePolicy(policy);
  const schema = useMemo(() => {
    const bounded = (limit: keyof LockoutSettings) => {
      const bounds = { min: limits.min[limit], max: limits.max[limit] };
      const message = t("password.lockout.outOfRange", bounds);
      return z.number().int(message).min(bounds.min, message).max(bounds.max, message).nullable();
    };
    return z.object({
      lockout_threshold: bounded("threshold"),
      lockout_window_minutes: bounded("window_minutes"),
      lockout_duration_minutes: bounded("duration_minutes"),
    });
  }, [limits, t]);
  const form = useAppForm({
    defaultValues: {
      lockout_threshold: policy.lockout_threshold,
      lockout_window_minutes: policy.lockout_window_minutes,
      lockout_duration_minutes: policy.lockout_duration_minutes,
    } as LockoutValues,
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await save
        .run(value)
        .then(onDone)
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });
  return (
    <Panel
      title={t("password.lockout.panelTitle")}
      description={t("password.lockout.panelDescription")}
    >
      <form
        className="account-panel-form am-panel-wide"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <div className="am-fields">
          {LOCKOUT.map((f) => (
            <form.AppField key={f.key} name={f.key}>
              {(field) => (
                <field.NumberField
                  label={t(`password.lockout.${f.copy}.field`)}
                  description={t(`password.lockout.${f.copy}.help`, {
                    value: limits.defaults[f.limit],
                    min: limits.min[f.limit],
                    max: limits.max[f.limit],
                  })}
                  placeholder={t("methods.example", { value: limits.defaults[f.limit] })}
                  min={limits.min[f.limit]}
                  max={limits.max[f.limit]}
                  step={1}
                  inputMode="numeric"
                />
              )}
            </form.AppField>
          ))}
        </div>
        <Failure error={save.error} />
        <span className="account-panel-actions">
          <Button size="lg" type="submit" loading={save.pending}>
            {t("password.lockout.save")}
          </Button>
          <Button variant="ghost" size="lg" onClick={onDone}>
            {t("methods.cancel")}
          </Button>
        </span>
      </form>
    </Panel>
  );
}
