import { KeyRoundIcon } from "@qeetrix/icons";
import { Button, Drawer, DrawerBody, DrawerContent, DrawerFooter } from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { type User, useSetUserPassword } from "@/modules/users/api/users";
import { personNames } from "@/modules/users/person-model";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

type SetPasswordSheetProps = {
  user: User | null;
  onOpenChange: (open: boolean) => void;
};

/**
 * Set a password for someone, from the Users list and their page. The server checks it against
 * the organisation's password rules, ends every way they're signed in, and emails them; it refuses
 * when the account also belongs to another organisation (only they can change it then).
 */
export function SetPasswordSheet({ user, onOpenChange }: SetPasswordSheetProps) {
  const { t } = useTranslation("users");
  return (
    <Drawer open={!!user} onOpenChange={onOpenChange}>
      <DrawerContent
        title={user ? t("person.password.title", { name: personNames(user).full }) : ""}
        description={user ? t("person.password.description", { email: user.email }) : undefined}
        size="md"
      >
        {user ? (
          <SetPasswordForm key={user.id} user={user} onDone={() => onOpenChange(false)} />
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function SetPasswordForm({ user, onDone }: { user: User; onDone: () => void }) {
  const { t } = useTranslation(["users", "common"]);
  const formId = useId();
  const setM = useSetUserPassword();
  const runSensitive = useSensitiveAction();
  const { first } = personNames(user);

  const schema = useMemo(
    () =>
      z
        .object({
          // The server's own limit; the organisation's rules (length, characters, breaches) are
          // checked there and come back as field errors.
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
    <>
      <DrawerBody>
        <form
          id={formId}
          className="sub-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <Alert tone="warning" title={t("person.password.effectTitle", { name: first })}>
            {t("person.password.effect", { name: first })}
          </Alert>
          <form.AppField name="password">
            {(field) => (
              <field.PasswordField
                label={t("setPassword.newPassword")}
                description={t("person.password.rules")}
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
        </form>
      </DrawerBody>
      <DrawerFooter>
        <Button variant="ghost" onClick={onDone} disabled={setM.isPending}>
          {t("common:actions.cancel")}
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" form={formId} icon={KeyRoundIcon} loading={submitting}>
              {t("setPassword.submit")}
            </Button>
          )}
        </form.Subscribe>
      </DrawerFooter>
    </>
  );
}
