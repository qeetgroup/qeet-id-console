import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  FieldGroup,
  Skeleton,
} from "@qeetrix/ui";
import { useStore } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { CheckIcon } from "@qeetrix/icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { formatLocale } from "@/i18n";
import { DataState } from "@/platform/components/data-state";
import { PageHeader } from "@/platform/components/page-header";
import {
  applyServerErrors,
  FieldFrame,
  FormError,
  useAppForm,
  useFieldChange,
} from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

import {
  type SecurityPolicy,
  type StepUpMethod,
  useSaveSecurityPolicy,
  useSecurityPolicy,
} from "../api/security-policy";

// The factor types a step-up may be met with, in the order shown.
const STEP_UP_METHODS: StepUpMethod[] = ["webauthn", "totp", "recovery_code", "otp", "push"];
const STEP_UP_WINDOWS = ["1m", "5m", "10m", "15m", "30m", "1h"]; // the server accepts 1m–60m
const SKELETON_IDS = ["a", "b", "c", "d", "e"] as const;

const DEFAULTS: Omit<SecurityPolicy, "tenant_id"> = {
  password_min_length: 8,
  password_complexity: "standard",
  session_max_age: "720h",
  session_idle_timeout: "24h",
  max_sessions: null,
  session_limit_action: "evict_oldest",
  mfa_enforcement: "optional",
  mfa_grace_days: 0,
  step_up_window: "5m",
  step_up_methods: null,
};

/** Renders the organization's security policy: passwords, sessions, MFA and step-up. */
export function SecurityPolicyPage() {
  const { t } = useTranslation("authorization");
  const policyQ = useSecurityPolicy();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("policies.description")} />
      <DataState
        isLoading={policyQ.isLoading}
        isError={policyQ.isError}
        error={policyQ.error}
        loading={
          <Card>
            <CardContent className="space-y-3 p-6">
              {SKELETON_IDS.map((id) => (
                <Skeleton key={id} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        }
      >
        {policyQ.data ? <PolicyForm saved={policyQ.data} /> : null}
      </DataState>
    </div>
  );
}

function PolicyForm({ saved }: { saved: SecurityPolicy }) {
  const { t } = useTranslation("authorization");
  const runSensitive = useSensitiveAction();
  const saveM = useSaveSecurityPolicy();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const initial = { ...DEFAULTS, ...saved };

  const schema = useMemo(
    () =>
      z.object({
        password_min_length: z
          .number(t("policies.validation.whole"))
          .int(t("policies.validation.whole"))
          .min(8, t("policies.validation.passwordLength"))
          .max(128, t("policies.validation.passwordLength")),
        max_sessions: z
          .number()
          .int(t("policies.validation.whole"))
          .min(1, t("policies.validation.maxSessions"))
          .max(1000, t("policies.validation.maxSessions"))
          .nullable(),
        mfa_grace_days: z
          .number(t("policies.validation.whole"))
          .int(t("policies.validation.whole"))
          .min(0, t("policies.validation.graceDays"))
          .max(90, t("policies.validation.graceDays")),
        session_max_age: z.string().trim().min(1, t("policies.validation.duration")),
        session_idle_timeout: z.string().trim().min(1, t("policies.validation.duration")),
        tenant_id: z.string(),
        password_complexity: z.string(),
        session_limit_action: z.string(),
        mfa_enforcement: z.string(),
        mfa_enforced_since: z.string().nullish(),
        step_up_window: z.string(),
        step_up_methods: z.array(z.enum(STEP_UP_METHODS)).nullable(),
        settings: z.record(z.string(), z.unknown()).nullish(),
      }),
    [t],
  );

  const form = useAppForm({
    defaultValues: initial,
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await runSensitive({
        actionLabel: t("policies.saveAction"),
        run: () => saveM.mutateAsync(value),
      })
        .then(() => setSavedAt(new Date()))
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });
  const values = useStore(form.store, (state) => state.values);
  const stepUpWindows = STEP_UP_WINDOWS.includes(values.step_up_window)
    ? STEP_UP_WINDOWS
    : [values.step_up_window, ...STEP_UP_WINDOWS];

  // When the saved requirement's grace period ends, while it is still running.
  const graceEndsAt =
    saved.mfa_enforced_since && saved.mfa_grace_days > 0
      ? new Date(new Date(saved.mfa_enforced_since).getTime() + saved.mfa_grace_days * 86_400_000)
      : null;
  const graceEnds =
    graceEndsAt && graceEndsAt.getTime() > Date.now()
      ? graceEndsAt.toLocaleDateString(formatLocale(), { dateStyle: "long" })
      : null;

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("policies.network.title")}</CardTitle>
          <CardDescription>
            {t("policies.network.movedToRules")}{" "}
            <Link to="/security/threats/ip-allowlist" className="underline">
              {t("policies.network.openRules")}
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("policies.password.title")}</CardTitle>
          <CardDescription>{t("policies.password.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field className="grid grid-cols-2 gap-4">
              <form.AppField name="password_min_length">
                {(field) => (
                  <field.NumberField
                    label={t("policies.password.minLengthLabel")}
                    min={8}
                    max={128}
                  />
                )}
              </form.AppField>
              <form.AppField name="password_complexity">
                {(field) => (
                  <field.SelectField
                    label={t("policies.password.complexityLabel")}
                    options={[
                      { value: "relaxed", label: t("policies.password.complexityBasic") },
                      { value: "standard", label: t("policies.password.complexityStandard") },
                      { value: "strict", label: t("policies.password.complexityStrict") },
                    ]}
                  />
                )}
              </form.AppField>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("policies.session.title")}</CardTitle>
          <CardDescription>{t("policies.session.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <form.AppField name="session_max_age">
              {(field) => (
                <field.TextField
                  label={t("policies.session.maxAgeLabel")}
                  description={t("policies.session.maxAgeHelp")}
                  placeholder="720h"
                />
              )}
            </form.AppField>
            <form.AppField name="session_idle_timeout">
              {(field) => (
                <field.TextField
                  label={t("policies.session.idleLabel")}
                  description={t("policies.session.idleHelp")}
                  placeholder="24h"
                />
              )}
            </form.AppField>
            <Field className="grid grid-cols-2 gap-4">
              <form.AppField name="max_sessions">
                {(field) => (
                  <field.NumberField
                    label={t("policies.session.maxSessionsLabel")}
                    placeholder={t("policies.session.maxSessionsNone")}
                    min={1}
                    max={1000}
                  />
                )}
              </form.AppField>
              <form.AppField name="session_limit_action">
                {(field) => (
                  <field.SelectField
                    label={t("policies.session.limitActionLabel")}
                    disabled={values.max_sessions === null}
                    options={[
                      { value: "evict_oldest", label: t("policies.session.limitEvict") },
                      { value: "refuse", label: t("policies.session.limitRefuse") },
                    ]}
                  />
                )}
              </form.AppField>
            </Field>
            <p className="text-sm text-muted-foreground">{t("policies.session.limitHelp")}</p>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("policies.mfa.title")}</CardTitle>
          <CardDescription>{t("policies.mfa.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <form.AppField name="mfa_enforcement">
              {(field) => (
                <field.SelectField
                  label={t("policies.mfa.modeLabel")}
                  description={t("policies.mfa.noteHelp")}
                  options={[
                    { value: "optional", label: t("policies.mfa.optional") },
                    { value: "required", label: t("policies.mfa.required") },
                    { value: "admin_only", label: t("policies.mfa.adminOnly") },
                  ]}
                />
              )}
            </form.AppField>
            {values.mfa_enforcement !== "optional" && (
              <form.AppField name="mfa_grace_days">
                {(field) => (
                  <field.NumberField
                    label={t("policies.mfa.graceLabel")}
                    description={`${t("policies.mfa.graceHelp")}${
                      graceEnds ? ` ${t("policies.mfa.graceEnds", { date: graceEnds })}` : ""
                    }`}
                    min={0}
                    max={90}
                  />
                )}
              </form.AppField>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("policies.stepUp.title")}</CardTitle>
          <CardDescription>{t("policies.stepUp.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="sm:w-60">
              <form.AppField name="step_up_window">
                {(field) => (
                  <field.SelectField
                    label={t("policies.stepUp.windowLabel")}
                    description={t("policies.stepUp.windowHelp")}
                    options={stepUpWindows.map((w) => ({
                      value: w,
                      label: t(`policies.stepUp.window.${w}`, { defaultValue: w }),
                    }))}
                  />
                )}
              </form.AppField>
            </div>
            <form.AppField name="step_up_methods">
              {(field) => (
                <FieldFrame
                  label={t("policies.stepUp.methodsLabel")}
                  description={t("policies.stepUp.methodsHelp")}
                >
                  <StepUpMethods selected={field.state.value} />
                </FieldFrame>
              )}
            </form.AppField>
          </FieldGroup>
        </CardContent>
      </Card>

      <FormError error={saveM.error} />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {savedAt
            ? t("policies.savedAt", { time: savedAt.toLocaleTimeString(formatLocale()) })
            : t("policies.unsaved")}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            disabled={saveM.isPending}
          >
            {t("policies.resetBtn")}
          </Button>
          <form.AppForm>
            <form.SubmitButton
              icon={saveM.isSuccess ? <CheckIcon /> : undefined}
              pendingLabel={t("policies.savingBtn")}
            >
              {t("policies.saveBtn")}
            </form.SubmitButton>
          </form.AppForm>
        </div>
      </div>
    </form>
  );
}

// null means every factor type counts; at least one stays ticked, and ticking them all sends null.
function StepUpMethods({ selected }: { selected: StepUpMethod[] | null }) {
  const { t } = useTranslation("authorization");
  const change = useFieldChange<StepUpMethod[] | null>();
  const current = selected ?? STEP_UP_METHODS;
  const toggle = (m: StepUpMethod, on: boolean) => {
    const next = STEP_UP_METHODS.filter((x) => (x === m ? on : current.includes(x)));
    if (next.length === 0) return;
    change(next.length === STEP_UP_METHODS.length ? null : next);
  };
  return (
    <div className="flex flex-col gap-2 pt-1">
      {STEP_UP_METHODS.map((m) => (
        <div key={m} className="flex items-center gap-2 text-sm">
          {/* A @base-ui custom element: label it with aria-label. */}
          <Checkbox
            aria-label={t(`policies.stepUp.method.${m}`)}
            checked={current.includes(m)}
            disabled={current.length === 1 && current.includes(m)}
            onCheckedChange={(c) => toggle(m, c === true)}
          />
          <span aria-hidden>{t(`policies.stepUp.method.${m}`)}</span>
        </div>
      ))}
    </div>
  );
}
