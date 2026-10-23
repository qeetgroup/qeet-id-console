import { Button, Field, FieldDescription, FieldLabel, Input } from "@qeetrix/ui";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useConfirmEmailChange, useStartEmailChange } from "@/modules/authentication";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

const CODE_LENGTH = 6;

/**
 * Renders the email address and the change that replaces it: a code goes to the new address,
 * and entering it confirms. Password resets go to this address, so sending the code needs a
 * step-up.
 */
export function EmailChange({ email, onChanged }: { email: string; onChanged: () => void }) {
  const { t } = useTranslation("account");
  const [changing, setChanging] = useState(false);
  // The address a code was sent to; the confirm step shows once it is set.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const close = () => {
    setChanging(false);
    setSentTo(null);
  };

  return (
    <Field className="border-t pt-6">
      <FieldLabel htmlFor="email">{t("profile.email")}</FieldLabel>
      {!changing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input id="email" className="max-w-xs" value={email} disabled />
          <Button type="button" variant="outline" size="sm" onClick={() => setChanging(true)}>
            {t("profile.emailChange")}
          </Button>
        </div>
      ) : (
        <div className="grid max-w-sm gap-3 rounded-md border bg-muted/30 p-3">
          <NewEmailForm onSent={setSentTo} onCancel={close} resend={sentTo !== null} />
          {sentTo && (
            <ConfirmCodeForm
              key={sentTo}
              onConfirmed={() => {
                close();
                onChanged();
              }}
            />
          )}
        </div>
      )}
      <FieldDescription>{t("profile.emailHelp")}</FieldDescription>
    </Field>
  );
}

function NewEmailForm({
  onSent,
  onCancel,
  resend,
}: {
  onSent: (email: string) => void;
  onCancel: () => void;
  resend: boolean;
}) {
  const { t } = useTranslation(["account", "common"]);
  const runSensitive = useSensitiveAction();
  const startM = useStartEmailChange();
  const schema = useMemo(() => z.object({ email: z.email(t("profile.validation.email")) }), [t]);
  const form = useAppForm({
    defaultValues: { email: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      const email = value.email.trim();
      await runSensitive({
        actionLabel: t("profile.emailChangeAction"),
        run: () => startM.mutateAsync(email),
      })
        .then((sent) => sent !== undefined && onSent(email))
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <form
      className="grid gap-2"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label={t("profile.emailNew")}
            type="email"
            autoComplete="email"
            placeholder={t("profile.emailNewPlaceholder")}
            required
          />
        )}
      </form.AppField>
      <FormError error={startM.error} />
      <div className="flex items-center gap-2">
        <form.AppForm>
          <form.SubmitButton variant="outline">
            {resend ? t("profile.emailResend") : t("profile.emailSend")}
          </form.SubmitButton>
        </form.AppForm>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t("common:actions.cancel")}
        </Button>
      </div>
    </form>
  );
}

function ConfirmCodeForm({ onConfirmed }: { onConfirmed: () => void }) {
  const { t } = useTranslation("account");
  const confirmM = useConfirmEmailChange();
  const schema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .trim()
          .length(CODE_LENGTH, t("profile.validation.code", { count: CODE_LENGTH })),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { code: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await confirmM
        .mutateAsync(value.code.trim())
        .then(onConfirmed)
        .catch((err: unknown) => applyServerErrors(formApi, err));
    },
  });

  return (
    <form
      className="grid gap-2"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex items-end gap-2">
        <div className="max-w-40">
          <form.AppField name="code">
            {(field) => (
              <field.TextField
                label={t("profile.emailCode")}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
            )}
          </form.AppField>
        </div>
        <form.AppForm>
          <form.SubmitButton>{t("profile.emailConfirm")}</form.SubmitButton>
        </form.AppForm>
      </div>
      <FormError error={confirmM.error} />
    </form>
  );
}
