import {
  Button,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
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

import { type User, useUpdateUser } from "../api/users";

type EditUserSheetProps = {
  user: User | null;
  isSelf: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Renders the sheet that edits a user's display name, phone and status. */
export function EditUserSheet({ user, isSelf, onOpenChange }: EditUserSheetProps) {
  return (
    <Sheet open={!!user} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {/* Keyed by user, so the form starts from that user's values. */}
        {user && (
          <EditUserForm
            key={user.id}
            user={user}
            isSelf={isSelf}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function EditUserForm({
  user,
  isSelf,
  onDone,
}: {
  user: User;
  isSelf: boolean;
  onDone: () => void;
}) {
  const { t } = useTranslation(["users", "common"]);
  const updateM = useUpdateUser();
  const runSensitive = useSensitiveAction();

  const schema = useMemo(
    () =>
      z.object({
        display_name: z.string().max(200, t("edit.validation.displayName")),
        phone: z
          .string()
          .trim()
          .regex(/^(\+[1-9]\d{1,14})?$/, t("edit.validation.phone")),
        status: z.enum(["active", "suspended"]),
      }),
    [t],
  );

  const form = useAppForm({
    defaultValues: {
      display_name: user.display_name ?? "",
      phone: user.phone ?? "",
      status: (user.status === "suspended" ? "suspended" : "active") as "active" | "suspended",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      const suspending = !isSelf && value.status === "suspended" && user.status !== "suspended";
      await runSensitive({
        // Suspending ends the person's access, so it is confirmed like the Suspend action.
        confirm: suspending
          ? {
              title: t("detail.suspendTitle"),
              description: t("detail.suspendDescription"),
              confirmLabel: t("detail.suspendConfirm"),
              tone: "destructive",
            }
          : undefined,
        actionLabel: t("edit.title"),
        run: () =>
          updateM.mutateAsync({
            userId: user.id,
            body: {
              display_name: value.display_name.trim() || null,
              phone: value.phone.trim() || null,
              ...(isSelf ? {} : { status: value.status }), // nobody can suspend themselves
            },
          }),
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
        <SheetTitle>{t("edit.title")}</SheetTitle>
        <SheetDescription>{t("edit.description")}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="edit-email">{t("edit.email")}</FieldLabel>
            <Input id="edit-email" value={user.email} readOnly disabled />
          </Field>
          <form.AppField name="display_name">
            {(field) => <field.TextField label={t("edit.displayName")} />}
          </form.AppField>
          <form.AppField name="phone">
            {(field) => (
              <field.TextField
                label={t("edit.phone")}
                description={t("edit.phoneHelp")}
                type="tel"
                placeholder="+15555550100"
              />
            )}
          </form.AppField>
          <form.AppField name="status">
            {(field) => (
              <field.SelectField
                label={t("edit.status")}
                description={isSelf ? t("edit.statusSelfHelp") : t("edit.statusHelp")}
                options={[
                  { value: "active", label: t("edit.statusActive") },
                  { value: "suspended", label: t("edit.statusSuspended") },
                ]}
                disabled={isSelf}
              />
            )}
          </form.AppField>
          <FormError error={updateM.error} />
        </FieldGroup>
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("common:actions.cancel")}
        </SheetClose>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("common:actions.saving")}>
            {t("common:actions.saveChanges")}
          </form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}
