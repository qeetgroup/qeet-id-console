import {
  Button,
  FieldGroup,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@qeetrix/ui";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

import { type User, useSetUserPassword } from "../api/users";

type SetPasswordSheetProps = {
  user: User | null;
  onOpenChange: (open: boolean) => void;
};

/** Renders the sheet that sets a new password for a user. */
export function SetPasswordSheet({ user, onOpenChange }: SetPasswordSheetProps) {
  return (
    <Sheet open={!!user} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {user && <SetPasswordForm key={user.id} user={user} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function SetPasswordForm({ user, onDone }: { user: User; onDone: () => void }) {
  const { t } = useTranslation(["users", "common"]);
  const setM = useSetUserPassword();
  const runSensitive = useSensitiveAction();

  const schema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .min(8, t("setPassword.validation.password"))
            .max(256, t("setPassword.validation.password")),
          confirm: z.string(),
        })
        .refine((v) => v.password === v.confirm, {
          path: ["confirm"],
          message: t("setPassword.mismatch"),
        }),
    [t],
  );

  const form = useAppForm({
    defaultValues: { password: "", confirm: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await runSensitive({
        actionLabel: t("setPassword.actionLabel"),
        run: () => setM.mutateAsync({ userId: user.id, password: value.password }),
      })
        .then(onDone)
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <form
      className="flex h-full flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <SheetHeader>
        <SheetTitle>{t("setPassword.title")}</SheetTitle>
        <SheetDescription>
          {t("setPassword.descriptionPlain", { email: user.email })}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <form.AppField name="password">
            {(field) => (
              <field.PasswordField
                label={t("setPassword.newPassword")}
                description={t("setPassword.newPasswordHelp")}
                autoComplete="new-password"
                required
              />
            )}
          </form.AppField>
          <form.AppField name="confirm">
            {(field) => (
              <field.PasswordField
                label={t("setPassword.confirmPassword")}
                autoComplete="new-password"
                required
              />
            )}
          </form.AppField>
          <FormError error={setM.error} />
        </FieldGroup>
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("common:actions.cancel")}
        </SheetClose>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("common:actions.saving")}>
            {t("setPassword.submit")}
          </form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}
