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
import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { roleQueries } from "@/modules/authorization";
import { useOrgs } from "@/modules/organizations";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

import { useCreateInvitation } from "../api/invitations";

/** Renders the sheet that invites someone, by email, into an organization the caller belongs to. */
export function InviteSheet({
  open,
  onOpenChange,
  currentTenantId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTenantId: string | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {open && (
          <InviteForm currentTenantId={currentTenantId} onDone={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function InviteForm({
  currentTenantId,
  onDone,
}: {
  currentTenantId: string | null;
  onDone: () => void;
}) {
  const { t } = useTranslation("invitations");
  const runSensitive = useSensitiveAction();
  const createM = useCreateInvitation();
  const orgsQ = useOrgs();

  const schema = useMemo(
    () =>
      z.object({
        email: z.email(t("create.validation.email")),
        tenant_id: z.string().min(1, t("create.validation.workspace")),
        role_id: z.string(),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { email: "", tenant_id: currentTenantId ?? "", role_id: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      // Inviting someone hands them a role, so the server asks for a step-up.
      await runSensitive({
        actionLabel: t("create.sendAction").toLowerCase(),
        run: () =>
          createM.mutateAsync({
            tenant_id: value.tenant_id,
            email: value.email.trim(),
            role_id: value.role_id || undefined,
          }),
      })
        .then(onDone)
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  // Roles belong to an organization, so the list and its default follow the one chosen.
  const tenantId = useStore(form.store, (state) => state.values.tenant_id);
  const rolesQ = useQuery(roleQueries.list(tenantId || null));
  const roles = rolesQ.data?.items ?? [];
  useEffect(() => {
    // A "member"-type role by default, so the accepted user shows in the role-based members list.
    const items = rolesQ.data?.items ?? [];
    const member = items.find((r) => /member/i.test(r.name));
    form.setFieldValue("role_id", member?.id ?? items.at(-1)?.id ?? "");
  }, [rolesQ.data, form]);

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
        <SheetTitle>{t("create.title")}</SheetTitle>
        <SheetDescription>{t("create.description")}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <form.AppField name="email">
            {(field) => <field.TextField label={t("create.email")} type="email" required />}
          </form.AppField>
          <form.AppField name="tenant_id">
            {(field) => (
              <field.SelectField
                label={t("create.workspace")}
                description={t("create.workspaceHelp")}
                placeholder={
                  orgsQ.isLoading
                    ? t("create.workspaceLoadingPlaceholder")
                    : t("create.workspacePlaceholder")
                }
                options={(orgsQ.data?.items ?? []).map((o) => ({ value: o.id, label: o.name }))}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="role_id">
            {(field) => (
              <field.SelectField
                label={t("create.role")}
                description={t("create.roleHelp")}
                placeholder={
                  rolesQ.isLoading
                    ? t("create.roleLoadingPlaceholder")
                    : t("create.rolePlaceholder")
                }
                options={roles.map((r) => ({ value: r.id, label: r.name }))}
              />
            )}
          </form.AppField>
          <FormError error={createM.error} />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("create.cancel")}
        </SheetClose>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("create.submitting")}>
            {t("create.submit")}
          </form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}
