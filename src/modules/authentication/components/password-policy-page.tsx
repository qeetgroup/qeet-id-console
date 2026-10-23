import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Slider,
  Switch,
} from "@qeetrix/ui";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { DataState } from "@/platform/components/data-state";
import { PageHeader } from "@/platform/components/page-header";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import { settleSensitiveAction } from "@/platform/security/sensitive-action-provider";
import { type AuthPolicy, type LockoutSettings, useAuthPolicy } from "../api/auth-policy";
import { useSaveAuthPolicy } from "./use-save-auth-policy";

const MIN_LENGTH = { min: 8, max: 64 };

// The three sign-in lockout settings, each with the limit it is checked against.
const LOCKOUT_FIELDS = [
  { key: "lockout_threshold", limit: "threshold", label: "password.lockoutThreshold" },
  {
    key: "lockout_window_minutes",
    limit: "window_minutes",
    label: "password.lockoutWindow",
    help: "password.lockoutWindowHelp",
  },
  { key: "lockout_duration_minutes", limit: "duration_minutes", label: "password.lockoutDuration" },
] as const satisfies readonly {
  key: keyof AuthPolicy;
  limit: keyof LockoutSettings;
  label: string;
  help?: string;
}[];

type PasswordSlice = Pick<
  AuthPolicy,
  | "password_enabled"
  | "password_min_length"
  | "password_require_uppercase"
  | "password_require_number"
  | "password_require_symbol"
  | "lockout_threshold"
  | "lockout_window_minutes"
  | "lockout_duration_minutes"
>;

function sliceOf(p: AuthPolicy): PasswordSlice {
  return {
    password_enabled: p.password_enabled,
    password_min_length: p.password_min_length,
    password_require_uppercase: p.password_require_uppercase,
    password_require_number: p.password_require_number,
    password_require_symbol: p.password_require_symbol,
    lockout_threshold: p.lockout_threshold,
    lockout_window_minutes: p.lockout_window_minutes,
    lockout_duration_minutes: p.lockout_duration_minutes,
  };
}

/** Renders the organization's password sign-in: on or off, complexity rules and lockout. */
export function PasswordPolicyPage() {
  const { t } = useTranslation("authentication");
  const policyQ = useAuthPolicy();
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader description={t("password.description")} />
      <DataState
        isLoading={policyQ.isLoading}
        isError={policyQ.isError}
        error={policyQ.error}
        isEmpty={false}
        skeletonRows={3}
      >
        {policyQ.data && <PasswordPolicyForm policy={policyQ.data} />}
      </DataState>
    </div>
  );
}

function PasswordPolicyForm({ policy }: { policy: AuthPolicy }) {
  const { t } = useTranslation(["authentication", "common"]);
  const save = useSaveAuthPolicy();
  const limits = policy.lockout_limits;
  const schema = useMemo(() => {
    // Empty means the platform default (null); the server refuses a value outside the bounds.
    const lockout = (limit: keyof LockoutSettings) => {
      if (!limits) return z.number().nullable();
      const bounds = { min: limits.min[limit], max: limits.max[limit] };
      const message = t("password.lockoutOutOfRange", bounds);
      return z.number().int(message).min(bounds.min, message).max(bounds.max, message).nullable();
    };
    return z.object({
      password_enabled: z.boolean(),
      password_min_length: z.number().int().min(MIN_LENGTH.min).max(MIN_LENGTH.max),
      password_require_uppercase: z.boolean(),
      password_require_number: z.boolean(),
      password_require_symbol: z.boolean(),
      lockout_threshold: lockout("threshold"),
      lockout_window_minutes: lockout("window_minutes"),
      lockout_duration_minutes: lockout("duration_minutes"),
    });
  }, [limits, t]);
  const form = useAppForm({
    defaultValues: sliceOf(policy),
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await save
        .run({ ...policy, ...value })
        .then((saved) => saved && formApi.reset(sliceOf(saved)))
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("password.authTitle")}</CardTitle>
            <CardDescription>{t("password.authDescription")}</CardDescription>
          </div>
          <form.Field name="password_enabled">
            {(field) => (
              <Switch
                checked={field.state.value}
                onCheckedChange={field.handleChange}
                aria-label={t("password.authTitle")}
              />
            )}
          </form.Field>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("password.complexityTitle")}</CardTitle>
          <CardDescription>{t("password.complexityDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <form.Field name="password_min_length">
            {(field) => (
              <Field>
                <FieldLabel id="password-min-length">
                  {t("password.minLength", { count: field.state.value })}
                </FieldLabel>
                <Slider
                  value={[field.state.value]}
                  onValueChange={(v) =>
                    field.handleChange(Array.isArray(v) ? (v[0] ?? MIN_LENGTH.min) : v)
                  }
                  min={MIN_LENGTH.min}
                  max={MIN_LENGTH.max}
                  step={1}
                  aria-labelledby="password-min-length"
                />
                <FieldDescription>{t("password.minLengthHelp")}</FieldDescription>
              </Field>
            )}
          </form.Field>
          <div className="flex flex-col gap-4">
            <form.AppField name="password_require_uppercase">
              {(field) => <field.SwitchField label={t("password.requireUppercase")} />}
            </form.AppField>
            <form.AppField name="password_require_number">
              {(field) => <field.SwitchField label={t("password.requireNumber")} />}
            </form.AppField>
            <form.AppField name="password_require_symbol">
              {(field) => <field.SwitchField label={t("password.requireSymbol")} />}
            </form.AppField>
          </div>
        </CardContent>
      </Card>

      {limits && (
        <Card>
          <CardHeader>
            <CardTitle>{t("password.lockoutTitle")}</CardTitle>
            <CardDescription>{t("password.lockoutDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-3">
            {LOCKOUT_FIELDS.map((f) => {
              const bounds = { min: limits.min[f.limit], max: limits.max[f.limit] };
              const help = t("password.lockoutDefault", {
                value: limits.defaults[f.limit],
                ...bounds,
              });
              return (
                <form.AppField key={f.key} name={f.key}>
                  {(field) => (
                    <field.NumberField
                      label={t(f.label)}
                      description={"help" in f ? `${t(f.help)} ${help}` : help}
                      placeholder={String(limits.defaults[f.limit])}
                      inputMode="numeric"
                      step={1}
                      {...bounds}
                    />
                  )}
                </form.AppField>
              );
            })}
          </CardContent>
        </Card>
      )}

      <FormError error={save.error} />
      <div className="flex justify-end gap-2">
        <form.AppForm>
          <form.ResetButton>{t("common:actions.reset")}</form.ResetButton>
          <form.SubmitButton requireChanges pendingLabel={t("common:actions.saving")}>
            {t("common:actions.saveChanges")}
          </form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}
