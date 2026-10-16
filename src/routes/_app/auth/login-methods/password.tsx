import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataState,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Slider,
  Switch,
} from "@qeetrix/ui";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import {
  type AuthPolicy,
  type LockoutLimits,
  type LockoutSettings,
  useAuthPolicy,
  useUpdateAuthPolicy,
} from "@/modules/authentication/api/auth-policy";

export const Route = createFileRoute("/_app/auth/login-methods/password")({
  component: PasswordPage,
});

type LockoutKey = "lockout_threshold" | "lockout_window_minutes" | "lockout_duration_minutes";

// The three sign-in lockout settings, each with the limit it is checked
// against. Empty = the platform default (sent as null).
const LOCKOUT_FIELDS: {
  key: LockoutKey;
  limit: keyof LockoutSettings;
  label: string;
  help?: string;
}[] = [
  { key: "lockout_threshold", limit: "threshold", label: "password.lockoutThreshold" },
  {
    key: "lockout_window_minutes",
    limit: "window_minutes",
    label: "password.lockoutWindow",
    help: "password.lockoutWindowHelp",
  },
  { key: "lockout_duration_minutes", limit: "duration_minutes", label: "password.lockoutDuration" },
];

// The server refuses a value outside the bounds; checking here keeps the form
// from submitting one. Unset (null) is always valid — it means the default.
function outOfRange(value: number | null, limits: LockoutLimits, limit: keyof LockoutSettings) {
  return (
    value !== null &&
    (!Number.isInteger(value) || value < limits.min[limit] || value > limits.max[limit])
  );
}

function PasswordPage() {
  const { t } = useTranslation("auth");
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
        {policyQ.data && <PasswordForm initial={policyQ.data} />}
      </DataState>
    </div>
  );
}

function PasswordForm({ initial }: { initial: AuthPolicy }) {
  const { t } = useTranslation("auth");
  const updateM = useUpdateAuthPolicy();
  const [draft, setDraft] = useState<AuthPolicy>(initial);
  const set = <K extends keyof AuthPolicy>(k: K, v: AuthPolicy[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  const limits = initial.lockout_limits;
  const lockoutInvalid =
    !!limits && LOCKOUT_FIELDS.some((f) => outOfRange(draft[f.key], limits, f.limit));

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("password.authTitle")}</CardTitle>
            <CardDescription>{t("password.authDescription")}</CardDescription>
          </div>
          <Switch
            checked={draft.password_enabled}
            onCheckedChange={(v) => set("password_enabled", v)}
          />
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("password.complexityTitle")}</CardTitle>
          <CardDescription>{t("password.complexityDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <Field>
            <FieldLabel>{t("password.minLength", { count: draft.password_min_length })}</FieldLabel>
            <Slider
              value={[draft.password_min_length]}
              onValueChange={(v) => set("password_min_length", Array.isArray(v) ? (v[0] ?? 8) : v)}
              min={8}
              max={64}
              step={1}
            />
            <FieldDescription>{t("password.minLengthHelp")}</FieldDescription>
          </Field>
          <div className="flex flex-col gap-4">
            <Field>
              <div className="flex items-center justify-between gap-4">
                <FieldLabel>{t("password.requireUppercase")}</FieldLabel>
                <Switch
                  checked={draft.password_require_uppercase}
                  onCheckedChange={(v) => set("password_require_uppercase", v)}
                />
              </div>
            </Field>
            <Field>
              <div className="flex items-center justify-between gap-4">
                <FieldLabel>{t("password.requireNumber")}</FieldLabel>
                <Switch
                  checked={draft.password_require_number}
                  onCheckedChange={(v) => set("password_require_number", v)}
                />
              </div>
            </Field>
            <Field>
              <div className="flex items-center justify-between gap-4">
                <FieldLabel>{t("password.requireSymbol")}</FieldLabel>
                <Switch
                  checked={draft.password_require_symbol}
                  onCheckedChange={(v) => set("password_require_symbol", v)}
                />
              </div>
            </Field>
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
              const min = limits.min[f.limit];
              const max = limits.max[f.limit];
              const invalid = outOfRange(draft[f.key], limits, f.limit);
              return (
                <Field key={f.key} data-invalid={invalid || undefined}>
                  <FieldLabel htmlFor={f.key}>{t(f.label)}</FieldLabel>
                  <Input
                    id={f.key}
                    type="number"
                    inputMode="numeric"
                    min={min}
                    max={max}
                    step={1}
                    placeholder={String(limits.defaults[f.limit])}
                    value={draft[f.key] ?? ""}
                    aria-invalid={invalid || undefined}
                    onChange={(e) =>
                      set(f.key, e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                  {invalid ? (
                    <FieldError>{t("password.lockoutOutOfRange", { min, max })}</FieldError>
                  ) : (
                    <FieldDescription>
                      {f.help ? `${t(f.help)} ` : ""}
                      {t("password.lockoutDefault", {
                        value: limits.defaults[f.limit],
                        min,
                        max,
                      })}
                    </FieldDescription>
                  )}
                </Field>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setDraft(initial)} disabled={updateM.isPending}>
          {t("common:actions.reset")}
        </Button>
        <Button
          onClick={() => updateM.mutate(draft)}
          disabled={updateM.isPending || lockoutInvalid}
        >
          {updateM.isPending ? t("common:actions.saving") : t("common:actions.saveChanges")}
        </Button>
      </div>
    </>
  );
}
