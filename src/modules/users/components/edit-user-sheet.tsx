import { PencilIcon } from "@qeetrix/icons";
import { Button, Drawer, DrawerBody, DrawerContent, DrawerFooter } from "@qeetrix/react";
import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { type User, useUpdateUser } from "@/modules/users/api/users";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";

type EditUserSheetProps = {
  user: User | null;
  onOpenChange: (open: boolean) => void;
};

/**
 * Edit details: the person's name and phone, from the Users list and their page. Suspending is its
 * own action, with its own confirmation, so it isn't a field here; the email address is the one
 * they sign in with, and only they change it (My account › Profile).
 */
export function EditUserSheet({ user, onOpenChange }: EditUserSheetProps) {
  const { t } = useTranslation("users");
  return (
    <Drawer open={!!user} onOpenChange={onOpenChange}>
      <DrawerContent
        title={t("person.edit.title")}
        description={user ? t("person.edit.description", { email: user.email }) : undefined}
        size="md"
      >
        {/* Keyed by person, so the form starts from their values. */}
        {user ? (
          <EditUserForm key={user.id} user={user} onDone={() => onOpenChange(false)} />
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function EditUserForm({ user, onDone }: { user: User; onDone: () => void }) {
  const { t } = useTranslation(["users", "common"]);
  const formId = useId();
  const updateM = useUpdateUser();

  const schema = useMemo(
    () =>
      z.object({
        display_name: z.string().max(200, t("edit.validation.displayName")),
        // The server takes E.164 only (UpdateInput: validate e164).
        phone: z
          .string()
          .trim()
          .regex(/^(\+[1-9]\d{1,14})?$/, t("edit.validation.phone")),
      }),
    [t],
  );

  const form = useAppForm({
    defaultValues: { display_name: user.display_name ?? "", phone: user.phone ?? "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      try {
        await updateM.mutateAsync({
          userId: user.id,
          body: {
            display_name: value.display_name.trim() || null,
            phone: value.phone.trim() || null,
          },
        });
        onDone();
      } catch (err) {
        applyServerErrors(formApi, err);
      }
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
          <form.AppField name="display_name">
            {(field) => (
              <field.TextField
                label={t("person.edit.name")}
                description={t("person.edit.nameHelp")}
                autoComplete="off"
              />
            )}
          </form.AppField>
          <form.AppField name="phone">
            {(field) => (
              <field.TextField
                label={t("person.edit.phone")}
                description={t("person.edit.phoneHelp")}
                type="tel"
                placeholder="+919876543210"
              />
            )}
          </form.AppField>
          <FormError error={updateM.error} />
        </form>
      </DrawerBody>
      <DrawerFooter>
        <Button variant="ghost" onClick={onDone} disabled={updateM.isPending}>
          {t("common:actions.cancel")}
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" form={formId} icon={PencilIcon} loading={submitting}>
              {t("common:actions.saveChanges")}
            </Button>
          )}
        </form.Subscribe>
      </DrawerFooter>
    </>
  );
}
