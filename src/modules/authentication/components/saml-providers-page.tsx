import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CopyableSecret,
  FieldDescription,
  FieldGroup,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { PencilIcon, PlusIcon, ServerIcon, TrashIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  idpMetadataUrl,
  type SamlProvider,
  useCreateSamlProvider,
  useDeleteSamlProvider,
  useSamlProviders,
  useUpdateSamlProvider,
} from "../api/saml-idp";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import { useMemo } from "react";
import { z } from "zod";

/** Renders the service providers that sign people in through Qeet ID as their SAML IdP. */
export function SamlProvidersPage() {
  const { t } = useTranslation("saml");
  const runSensitive = useSensitiveAction();
  const listQ = useSamlProviders();
  const deleteM = useDeleteSamlProvider();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SamlProvider | null>(null);

  const items = listQ.data?.items ?? [];

  const remove = (provider: SamlProvider) =>
    runSensitive({
      confirm: {
        title: t("delete.title"),
        description: t("delete.confirmDescription", { name: provider.name }),
        confirmLabel: t("common:actions.remove"),
        tone: "destructive",
      },
      actionLabel: t("delete.stepUp"),
      run: () => deleteM.mutateAsync(provider.id),
    }).catch(settleSensitiveAction);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title={t("page.title")}
        description={t("page.description")}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon /> {t("page.addProvider")}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("metadata.title")}</CardTitle>
          <CardDescription>{t("metadata.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <CopyableSecret value={idpMetadataUrl()} oneLine />
          <FieldDescription>{t("metadata.hint")}</FieldDescription>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("list.title")}</CardTitle>
          <CardDescription>{t("list.count", { count: items.length })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={listQ.isLoading}
            isError={listQ.isError}
            error={listQ.error}
            isEmpty={items.length === 0}
            emptyIcon={ServerIcon}
            emptyTitle={t("list.emptyTitle")}
            emptyDescription={t("list.emptyDescription")}
            skeletonRows={3}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.name")}</TableHead>
                  <TableHead>{t("table.entityId")}</TableHead>
                  <TableHead>{t("table.acsUrl")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                  <TableHead>{t("table.lastLogin")}</TableHead>
                  <TableHead className="text-right">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                      {p.entity_id}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                      {p.acs_url}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={p.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.last_login_at ? <TimeSince value={p.last_login_at} /> : "—"}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                        <PencilIcon /> {t("common:actions.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(p)}
                        disabled={deleteM.isPending}
                      >
                        <TrashIcon /> {t("common:actions.remove")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      <SamlProviderSheet open={creating} onOpenChange={setCreating} />
      <SamlProviderSheet
        provider={editing ?? undefined}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  );
}

/** Renders the sheet that adds a service provider, or edits `provider`. */
function SamlProviderSheet({
  provider,
  open,
  onOpenChange,
}: {
  provider?: SamlProvider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {open && (
          <SamlProviderForm
            key={provider?.id ?? "new"}
            provider={provider}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function SamlProviderForm({ provider, onDone }: { provider?: SamlProvider; onDone: () => void }) {
  const { t } = useTranslation("saml");
  const runSensitive = useSensitiveAction();
  const createM = useCreateSamlProvider();
  const updateM = useUpdateSamlProvider();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("form.validation.name")),
        entity_id: z.string().trim().min(1, t("form.validation.entityId")),
        acs_url: z.url({ protocol: /^https?$/, error: t("form.validation.acsUrl") }),
        name_id_format: z.string(),
        name_id_attribute: z.string(),
        certificate: z.string(),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: {
      name: provider?.name ?? "",
      entity_id: provider?.entity_id ?? "",
      acs_url: provider?.acs_url ?? "",
      name_id_format: provider?.name_id_format ?? "",
      name_id_attribute: provider?.name_id_attribute ?? "",
      certificate: provider?.certificate ?? "",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      const optional = (v: string) => v.trim() || undefined;
      const body = {
        name: value.name.trim(),
        entity_id: value.entity_id.trim(),
        acs_url: value.acs_url.trim(),
        name_id_format: optional(value.name_id_format),
        name_id_attribute: optional(value.name_id_attribute),
        certificate: optional(value.certificate),
      };
      await runSensitive({
        actionLabel: provider ? t("form.stepUpEdit") : t("form.stepUpAdd"),
        run: () =>
          provider ? updateM.mutateAsync({ id: provider.id, ...body }) : createM.mutateAsync(body),
      })
        .then((saved) => saved && onDone())
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
        <SheetTitle>{provider ? t("form.editTitle") : t("form.addTitle")}</SheetTitle>
        <SheetDescription>{t("form.description")}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <form.AppField name="name">
            {(field) => (
              <field.TextField label={t("form.name")} placeholder="Acme Analytics" required />
            )}
          </form.AppField>
          <form.AppField name="entity_id">
            {(field) => (
              <field.TextField
                label={t("form.entityId")}
                placeholder="https://analytics.acme.com/saml/metadata"
                required
              />
            )}
          </form.AppField>
          <form.AppField name="acs_url">
            {(field) => (
              <field.TextField
                label={t("form.acsUrl")}
                description={t("form.acsUrlHelp")}
                placeholder="https://analytics.acme.com/saml/acs"
                type="url"
                required
              />
            )}
          </form.AppField>
          <form.AppField name="name_id_format">
            {(field) => (
              <field.TextField
                label={t("form.nameIdFormat")}
                description={t("form.nameIdFormatHelp")}
                placeholder="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
              />
            )}
          </form.AppField>
          <form.AppField name="name_id_attribute">
            {(field) => (
              <field.TextField
                label={t("form.nameIdAttribute")}
                description={t("form.nameIdAttributeHelp")}
                placeholder="email"
              />
            )}
          </form.AppField>
          <form.AppField name="certificate">
            {(field) => (
              <field.TextareaField
                label={t("form.certificate")}
                description={t("form.certificateHelp")}
                placeholder="-----BEGIN CERTIFICATE----- …"
                rows={5}
                className="font-mono text-xs"
              />
            )}
          </form.AppField>
          <FormError error={createM.error ?? updateM.error} />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("common:actions.cancel")}
        </SheetClose>
        <form.AppForm>
          <form.SubmitButton
            pendingLabel={provider ? t("common:actions.saving") : t("form.addSubmitting")}
          >
            {provider ? t("common:actions.saveChanges") : t("form.addSubmit")}
          </form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}
