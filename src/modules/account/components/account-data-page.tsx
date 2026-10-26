import { DownloadIcon, TrashIcon } from "@qeetrix/icons";
import { Button, Card, Field } from "@qeetrix/react";
import { PasswordInput } from "@qeetrix/react/experimental";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { usePasswordStatus } from "@/modules/authentication";
import { errorMessage } from "@/platform/errors/user-message";
import {
  SensitiveActionCancelled,
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { useDeleteAccount, useExportAccount } from "../api/account-data";
import { AccountPage, Failure, Section } from "./account-parts";

/** The person's data: a copy of what's held about them, and erasing the account. */
export function AccountDataPage() {
  const { t } = useTranslation("account");
  const exportData = useExportAccount();
  return (
    <AccountPage title={t("data.title")} description={t("data.description")}>
      <Section
        title={t("data.export.title")}
        description={t("data.export.description")}
        action={
          <Button
            variant="soft"
            icon={DownloadIcon}
            loading={exportData.isPending}
            onClick={() => exportData.mutate()}
          >
            {t("data.export.button")}
          </Button>
        }
      />
      <DeleteAccount />
    </AccountPage>
  );
}

/**
 * Erasing the account, after a confirmation and a step-up. An account that signs in only with a
 * provider or a passkey has no password to confirm with.
 */
function DeleteAccount() {
  const { t } = useTranslation("account");
  const runSensitive = useSensitiveAction();
  const remove = useDeleteAccount();
  const hasPassword = usePasswordStatus().data?.has_password ?? true;
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null); // the password field's
  const [failure, setFailure] = useState<string | null>(null); // the request's

  function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    if (hasPassword && !password) return setError(t("data.delete.passwordRequired"));
    setError(null);
    runSensitive({
      confirm: {
        title: t("data.delete.confirmTitle"),
        description: t("data.delete.confirmDescription"),
        confirmLabel: t("data.delete.button"),
        tone: "destructive",
      },
      actionLabel: t("data.delete.button"),
      run: () => remove.mutateAsync(hasPassword ? password : null),
    }).catch((err: unknown) => {
      settleSensitiveAction(err);
      if (!(err instanceof SensitiveActionCancelled)) setFailure(errorMessage(err));
    });
  }

  return (
    <Card
      tone="danger"
      title={t("data.delete.title")}
      level={3}
      description={t("data.delete.description")}
      className="account-danger"
    >
      <form className="account-panel-form" noValidate onSubmit={submit}>
        {hasPassword ? (
          <Field
            label={t("data.delete.password")}
            description={t("data.delete.passwordHint")}
            error={error ?? undefined}
            invalid={!!error}
          >
            <PasswordInput
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
            />
          </Field>
        ) : null}
        {failure && <Failure>{failure}</Failure>}
        <span className="account-panel-actions">
          <Button type="submit" tone="danger" icon={TrashIcon} loading={remove.isPending}>
            {t("data.delete.button")}
          </Button>
        </span>
      </form>
    </Card>
  );
}
