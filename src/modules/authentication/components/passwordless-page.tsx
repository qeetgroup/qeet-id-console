import { Card, CardContent, CardDescription, CardHeader, CardTitle, Switch } from "@qeetrix/ui";
import {
  FingerprintPatternIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
  WandSparklesIcon,
} from "@qeetrix/icons";
import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { DataState } from "@/platform/components/data-state";
import { PageHeader } from "@/platform/components/page-header";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import { settleSensitiveAction } from "@/platform/security/sensitive-action-provider";
import { type AuthPolicy, useAuthPolicy } from "../api/auth-policy";
import { useSaveAuthPolicy } from "./use-save-auth-policy";

// The email and SMS one-time-code flags are not offered: no such sign-in exists, and the server
// refuses to switch them on.
const METHODS = [
  { key: "passkey_enabled", copy: "passkeys", icon: FingerprintPatternIcon },
  { key: "magic_link_enabled", copy: "magicLinks", icon: WandSparklesIcon },
] as const;

const schema = z.object({
  passkey_enabled: z.boolean(),
  magic_link_enabled: z.boolean(),
  remember_device_enabled: z.boolean(),
});

function sliceOf(p: AuthPolicy) {
  return {
    passkey_enabled: p.passkey_enabled,
    magic_link_enabled: p.magic_link_enabled,
    remember_device_enabled: p.remember_device_enabled,
  };
}

/** Renders the organization's passwordless sign-in methods and trusted devices. */
export function PasswordlessPage() {
  const { t } = useTranslation("auth");
  const policyQ = useAuthPolicy();
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader description={t("loginMethods.passwordless.description")} />
      <DataState
        isLoading={policyQ.isLoading}
        isError={policyQ.isError}
        error={policyQ.error}
        isEmpty={false}
        skeletonRows={3}
      >
        {policyQ.data && <PasswordlessForm policy={policyQ.data} />}
      </DataState>
    </div>
  );
}

function PasswordlessForm({ policy }: { policy: AuthPolicy }) {
  const { t } = useTranslation("auth");
  const save = useSaveAuthPolicy();
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

  // One method's card: what it is, and a switch that reads as on or off.
  const methodCard = (
    name: keyof ReturnType<typeof sliceOf>,
    Icon: ComponentType<{ className?: string }>,
    title: string,
    description: ReactNode,
    switchLabel = title,
  ) => (
    <Card key={name}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <form.Field name={name}>
        {(field) => (
          <CardContent className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {field.state.value
                ? t("loginMethods.passwordless.enabled")
                : t("loginMethods.passwordless.off")}
            </span>
            <Switch
              checked={field.state.value}
              aria-label={switchLabel}
              onCheckedChange={field.handleChange}
            />
          </CardContent>
        )}
      </form.Field>
    </Card>
  );

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {METHODS.map((m) =>
          methodCard(
            m.key,
            m.icon,
            t(`loginMethods.passwordless.methods.${m.copy}.title`),
            t(`loginMethods.passwordless.methods.${m.copy}.description`),
          ),
        )}
      </div>

      {methodCard(
        "remember_device_enabled",
        ShieldCheckIcon,
        t("loginMethods.passwordless.trustedDevices.title"),
        t("loginMethods.passwordless.trustedDevices.description"),
        t("loginMethods.passwordless.trustedDevices.ariaLabel"),
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRoundIcon className="size-4" /> {t("loginMethods.passwordless.passkeysMgmt.title")}
          </CardTitle>
          <CardDescription>
            {t("loginMethods.passwordless.passkeysMgmt.description")}
          </CardDescription>
        </CardHeader>
      </Card>

      <FormError error={save.error} />
      <div className="flex justify-end gap-2">
        <form.AppForm>
          <form.ResetButton>{t("loginMethods.passwordless.resetBtn")}</form.ResetButton>
          <form.SubmitButton requireChanges pendingLabel={t("loginMethods.passwordless.savingBtn")}>
            {t("loginMethods.passwordless.saveBtn")}
          </form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}
