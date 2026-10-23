import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  StatusPill,
} from "@qeetrix/ui";
import { KeyRoundIcon, LoaderCircleIcon } from "@qeetrix/icons";
import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { useChangePassword, useForgotPassword, usePasswordStatus } from "@/modules/authentication";
import { useMe } from "@/platform/auth/session";
import { toastError } from "@/platform/errors/error-toast";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Renders the password: change it, or set a first one on an account that signs in with a
 * provider or a passkey. A signed-in person is emailed a reset link, because /forgot-password
 * sits under the signed-out layout, which would send them back to the dashboard.
 */
export function PasswordCard() {
  const { t } = useTranslation("account");
  const me = useMe();
  const hasPassword = usePasswordStatus().data?.has_password ?? true;
  const forgot = useForgotPassword();

  const emailResetLink = () =>
    forgot.mutate(
      { email: me.data?.email ?? "" },
      {
        onSuccess: () => toast.success(t("security.password.resetSent")),
        onError: (err) => toastError(err),
      },
    );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRoundIcon className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">{t("security.password.title")}</CardTitle>
          </div>
          <StatusPill status={hasPassword ? "active" : "pending"} dot={false}>
            {hasPassword ? t("security.password.set") : t("security.password.notSet")}
          </StatusPill>
        </div>
        <CardDescription>
          {hasPassword
            ? t("security.password.description")
            : t("security.password.noneDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Remounted when a first password is set, so the form gains its current-password field. */}
        <PasswordForm
          key={String(hasPassword)}
          hasPassword={hasPassword}
          extra={
            hasPassword && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={forgot.isPending || !me.data?.email}
                onClick={emailResetLink}
              >
                {forgot.isPending && <LoaderCircleIcon className="animate-spin" />}
                {t("security.password.forgot")}
              </Button>
            )
          }
        />
      </CardContent>
    </Card>
  );
}

function PasswordForm({ hasPassword, extra }: { hasPassword: boolean; extra: ReactNode }) {
  const { t } = useTranslation("account");
  const changeM = useChangePassword();
  const schema = useMemo(
    () =>
      z.object({
        current_password: hasPassword
          ? z.string().min(1, t("security.password.validation.current"))
          : z.string(),
        new_password: z
          .string()
          .min(
            MIN_PASSWORD_LENGTH,
            t("security.password.validation.length", { count: MIN_PASSWORD_LENGTH }),
          ),
      }),
    [hasPassword, t],
  );
  const form = useAppForm({
    defaultValues: { current_password: "", new_password: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await changeM
        .mutateAsync({
          current_password: hasPassword ? value.current_password : "",
          new_password: value.new_password,
        })
        .then(() => {
          toast.success(
            hasPassword ? t("security.password.changed") : t("security.password.added"),
          );
          formApi.reset();
        })
        .catch((err: unknown) => applyServerErrors(formApi, err));
    },
  });

  return (
    <form
      className="grid max-w-sm gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      {hasPassword && (
        <form.AppField name="current_password">
          {(field) => (
            <field.PasswordField
              label={t("security.password.current")}
              autoComplete="current-password"
              required
            />
          )}
        </form.AppField>
      )}
      <form.AppField name="new_password">
        {(field) => (
          <field.PasswordField
            label={t("security.password.new")}
            description={t("security.password.newHelp", { count: MIN_PASSWORD_LENGTH })}
            autoComplete="new-password"
            required
          />
        )}
      </form.AppField>
      <FormError error={changeM.error} />
      <div className="flex items-center gap-2">
        <form.AppForm>
          <form.SubmitButton>
            {hasPassword ? t("security.password.update") : t("security.password.add")}
          </form.SubmitButton>
        </form.AppForm>
        {extra}
      </div>
    </form>
  );
}
