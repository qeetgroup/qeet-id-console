import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@qeetrix/ui";
import { DownloadIcon, TrashIcon } from "@qeetrix/icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { usePasswordStatus } from "@/modules/authentication";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { useDeleteAccount, useExportAccount } from "../api/account-data";

/** Renders the signed-in person's data: download an export, or erase the account. */
export function AccountDataPage() {
  const { t } = useTranslation("account");
  const exportM = useExportAccount();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DownloadIcon className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">{t("data.export.title")}</CardTitle>
          </div>
          <CardDescription>{t("data.export.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => exportM.mutate()} disabled={exportM.isPending}>
            <DownloadIcon /> {t("data.export.button")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-rose-500/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrashIcon className="size-5 text-rose-600 dark:text-rose-400" />
            <CardTitle className="text-base">{t("data.delete.title")}</CardTitle>
          </div>
          <CardDescription>{t("data.delete.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountForm />
        </CardContent>
      </Card>
    </div>
  );
}

function DeleteAccountForm() {
  const { t } = useTranslation("account");
  const runSensitive = useSensitiveAction();
  const deleteM = useDeleteAccount();
  // An account that signs in only with a provider or a passkey has no password to confirm.
  const hasPassword = usePasswordStatus().data?.has_password ?? true;
  const schema = useMemo(
    () =>
      z.object({
        password: hasPassword
          ? z.string().min(1, t("data.delete.validation.password"))
          : z.string(),
      }),
    [hasPassword, t],
  );
  const form = useAppForm({
    defaultValues: { password: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await runSensitive({
        confirm: {
          title: t("data.delete.confirm.title"),
          description: t("data.delete.confirm.description"),
          confirmLabel: t("data.delete.confirm.label"),
          tone: "destructive",
        },
        actionLabel: t("data.delete.button").toLowerCase(),
        run: () => deleteM.mutateAsync(hasPassword ? value.password : null),
      }).catch((err: unknown) => {
        applyServerErrors(formApi, err);
        settleSensitiveAction(err);
      });
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      {hasPassword && (
        <div className="max-w-xs">
          <form.AppField name="password">
            {(field) => (
              <field.PasswordField
                label={t("data.delete.password")}
                autoComplete="current-password"
                required
              />
            )}
          </form.AppField>
        </div>
      )}
      <FormError error={deleteM.error} />
      <div>
        <form.AppForm>
          <form.SubmitButton variant="outline" icon={<TrashIcon />}>
            {t("data.delete.button")}
          </form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}
