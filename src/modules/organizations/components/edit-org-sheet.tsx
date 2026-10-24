import {
  Button,
  Field,
  FieldDescription,
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

import {
  applyServerErrors,
  FieldFrame,
  FormError,
  useAppForm,
  useFieldChange,
} from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { REGIONS } from "@/shared/data/regions";
import { LogoField } from "@/shared/components/logo-field";

import { type Org, useUpdateOrg } from "../api/orgs";

/** Renders the sheet that edits an organization's name, logo, status and region. */
export function EditOrgSheet({
  org,
  onOpenChange,
}: {
  org: Org | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={!!org} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {org && <EditOrgForm key={org.id} org={org} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function EditOrgForm({ org, onDone }: { org: Org; onDone: () => void }) {
  const { t, i18n } = useTranslation("organizations");
  const runSensitive = useSensitiveAction();
  const updateM = useUpdateOrg({ silentError: true });
  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("tenants.edit.validation.name"))
          .max(200, t("tenants.edit.validation.nameTooLong")),
        logo_url: z.string(),
        status: z.enum(["active", "suspended"]),
        region: z.string(),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: {
      name: org.name,
      logo_url: org.logo_url ?? "",
      status: (org.status === "suspended" ? "suspended" : "active") as "active" | "suspended",
      region: org.region ?? "",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      const suspending = value.status === "suspended" && org.status !== "suspended";
      await runSensitive({
        capability: "tenant.write",
        // Suspending ends every member's access, so it is confirmed like the Suspend action.
        confirm: suspending
          ? {
              title: t("suspend.title"),
              description: t("suspend.description", { name: org.name }),
              confirmLabel: t("rowActions.suspend"),
              tone: "destructive",
            }
          : undefined,
        actionLabel: t("tenants.edit.editAction"),
        run: () => updateM.mutateAsync({ id: org.id, body: { ...value, name: value.name.trim() } }),
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
        <SheetTitle>{t("tenants.edit.title")}</SheetTitle>
        <SheetDescription>{t("tenants.edit.description")}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <form.AppField name="name">
            {(field) => <field.TextField label={t("tenants.edit.name")} required />}
          </form.AppField>
          <form.AppField name="logo_url">
            {(field) => (
              <FieldFrame label={t("tenants.edit.logo")}>
                <OrgLogo value={field.state.value} hint={t("tenants.edit.logoHelp")} />
              </FieldFrame>
            )}
          </form.AppField>
          <Field>
            <FieldLabel htmlFor="edit-org-slug">{t("tenants.edit.slug")}</FieldLabel>
            <Input id="edit-org-slug" value={org.slug} readOnly disabled />
            <FieldDescription>{t("tenants.edit.slugHelp")}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-org-plan">{t("tenants.edit.plan")}</FieldLabel>
            <Input
              id="edit-org-plan"
              value={(org.plan ?? "free").replace(/^./, (c) => c.toUpperCase())}
              readOnly
              disabled
            />
            <FieldDescription>{t("tenants.edit.planHelp")}</FieldDescription>
          </Field>
          <form.AppField name="status">
            {(field) => (
              <field.SelectField
                label={t("tenants.edit.status")}
                description={t("tenants.edit.statusHelp")}
                options={[
                  { value: "active", label: t("tenants.edit.statusActive") },
                  { value: "suspended", label: t("tenants.edit.statusSuspended") },
                ]}
              />
            )}
          </form.AppField>
          <form.AppField name="region">
            {(field) => (
              <field.SelectField
                label={t("tenants.edit.region")}
                options={REGIONS.map((r) => ({ value: r.value, label: i18n.t(r.label) }))}
              />
            )}
          </form.AppField>
          <FormError error={updateM.error} />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("tenants.edit.cancel")}
        </SheetClose>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("tenants.edit.saving")}>
            {t("tenants.edit.save")}
          </form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}

// The shared logo picker, bound to the enclosing form field.
function OrgLogo({ value, hint }: { value: string; hint: string }) {
  const change = useFieldChange<string>();
  return <LogoField value={value} onChange={change} hint={hint} />;
}
