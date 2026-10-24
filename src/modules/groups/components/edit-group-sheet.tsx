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

import { type Group, useUpdateGroup } from "../api/groups";

const TOP_LEVEL = "__top"; // the parent choice for a top-level group

/** Renders the sheet that renames a group, edits its description or moves it under a parent. */
export function EditGroupSheet({
  group,
  onOpenChange,
  groups,
}: {
  group: Group | null;
  onOpenChange: (open: boolean) => void;
  groups: Group[];
}) {
  return (
    <Sheet open={!!group} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {group && (
          <EditGroupForm
            key={group.id}
            group={group}
            groups={groups}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function EditGroupForm({
  group,
  groups,
  onDone,
}: {
  group: Group;
  groups: Group[];
  onDone: () => void;
}) {
  const { t } = useTranslation("groups");
  const updateM = useUpdateGroup();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("edit.validation.name")),
        description: z.string(),
        parent_id: z.string(),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: {
      name: group.name,
      description: group.description ?? "",
      parent_id: group.parent_id ?? TOP_LEVEL,
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await updateM
        .mutateAsync({
          groupId: group.id,
          body: {
            name: value.name.trim(),
            description: value.description.trim(),
            parent_id: value.parent_id === TOP_LEVEL ? null : value.parent_id,
          },
        })
        .then(onDone)
        .catch((err: unknown) => applyServerErrors(formApi, err));
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
          <form.AppField name="name">
            {(field) => <field.TextField label={t("edit.name")} required />}
          </form.AppField>
          <form.AppField name="description">
            {(field) => <field.TextareaField label={t("edit.description_field")} rows={3} />}
          </form.AppField>
          <form.AppField name="parent_id">
            {(field) => (
              <field.SelectField
                label={t("edit.parent")}
                options={[
                  { value: TOP_LEVEL, label: t("edit.parentNone") },
                  ...groups
                    .filter((g) => g.id !== group.id)
                    .map((g) => ({ value: g.id, label: g.name })),
                ]}
              />
            )}
          </form.AppField>
          <FormError error={updateM.error} />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("edit.cancel")}
        </SheetClose>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("edit.saving")}>{t("edit.save")}</form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}
