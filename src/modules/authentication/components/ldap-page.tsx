import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { PlugIcon, PlusIcon, ServerIcon, TrashIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { FeatureGate, useEntitlements } from "@/modules/billing";
import {
  useCreateLdapConnection,
  useDeleteLdapConnection,
  useLdapConnections,
  useTestLdapConnection,
  useUpdateLdapConnection,
} from "../api/ldap";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import { useMemo } from "react";
import { z } from "zod";

/** Renders the organization's LDAP and Active Directory connections, with test, enable and delete. */
export function LdapPage() {
  const { t } = useTranslation("auth");
  const runSensitive = useSensitiveAction();
  const listQ = useLdapConnections();
  const updateM = useUpdateLdapConnection();
  const deleteM = useDeleteLdapConnection();
  const testM = useTestLdapConnection();
  const [creating, setCreating] = useState(false);

  const items = listQ.data?.items ?? [];
  const ldapLocked = useEntitlements().data?.features.ldap === false;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        description={t("ldap.description")}
        actions={
          ldapLocked ? undefined : (
            <Button size="sm" onClick={() => setCreating(true)}>
              <PlusIcon className="mr-2 size-4" />
              {t("ldap.newButton")}
            </Button>
          )
        }
      />

      <FeatureGate
        feature="ldap"
        title={t("ldap.gate.title")}
        description={t("ldap.gate.description")}
      >
        <Card>
          <CardHeader>
            <CardTitle>{t("ldap.list.title")}</CardTitle>
            <CardDescription>{t("ldap.list.description")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <DataState
              isLoading={listQ.isLoading}
              isError={listQ.isError}
              error={listQ.error}
              isEmpty={items.length === 0}
              emptyIcon={ServerIcon}
              emptyTitle={t("ldap.list.empty")}
              skeletonRows={3}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("ldap.columns.name")}</TableHead>
                    <TableHead>{t("ldap.columns.server")}</TableHead>
                    <TableHead>{t("ldap.columns.status")}</TableHead>
                    <TableHead>{t("ldap.columns.lastLogin")}</TableHead>
                    <TableHead className="text-right">{t("ldap.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="max-w-65 truncate font-mono text-xs text-muted-foreground">
                        {c.server_url}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={c.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.last_login_at ? <TimeSince value={c.last_login_at} /> : "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => testM.mutate(c.id)}
                          disabled={testM.isPending}
                          title={t("ldap.testTitle")}
                        >
                          <PlugIcon /> {t("ldap.testBtn")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            runSensitive({
                              actionLabel:
                                c.status === "active"
                                  ? t("ldap.stepUp.disable")
                                  : t("ldap.stepUp.enable"),
                              run: () =>
                                updateM.mutateAsync({
                                  id: c.id,
                                  status: c.status === "active" ? "disabled" : "active",
                                }),
                            }).catch(settleSensitiveAction)
                          }
                          disabled={updateM.isPending}
                        >
                          {c.status === "active" ? t("ldap.disable") : t("ldap.enable")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            runSensitive({
                              confirm: {
                                title: t("ldap.confirm.title", { name: c.name }),
                                confirmLabel: t("ldap.confirm.label"),
                                tone: "destructive",
                              },
                              actionLabel: t("ldap.stepUp.delete"),
                              run: () => deleteM.mutateAsync(c.id),
                            }).catch(settleSensitiveAction)
                          }
                          disabled={deleteM.isPending}
                        >
                          <TrashIcon /> {t("ldap.deleteBtn")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataState>
          </CardContent>
        </Card>
      </FeatureGate>

      <CreateConnectionSheet open={creating} onOpenChange={setCreating} />
    </div>
  );
}

/** Renders the sheet that connects an LDAP or Active Directory server. */
function CreateConnectionSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {open && <CreateConnectionForm onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function CreateConnectionForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation("auth");
  const runSensitive = useSensitiveAction();
  const createM = useCreateLdapConnection();
  const schema = useMemo(() => {
    const required = (key: string) =>
      z
        .string()
        .trim()
        .min(1, t(`ldap.create.validation.${key}`));
    return z.object({
      name: required("name"),
      server_url: z
        .string()
        .trim()
        .regex(/^ldaps?:\/\/\S+$/i, t("ldap.create.validation.serverUrl")),
      bind_dn: required("bindDn"),
      bind_password: z.string().min(1, t("ldap.create.validation.bindPassword")),
      base_dn: required("baseDn"),
      user_filter: z.string(),
      email_attribute: z.string(),
      name_attribute: z.string(),
      start_tls: z.boolean(),
      skip_tls_verify: z.boolean(),
      status: z.enum(["draft", "active"]),
    });
  }, [t]);
  const form = useAppForm({
    defaultValues: {
      name: "",
      server_url: "",
      bind_dn: "",
      bind_password: "",
      base_dn: "",
      user_filter: "(uid=%s)",
      email_attribute: "mail",
      name_attribute: "cn",
      start_tls: false,
      skip_tls_verify: false,
      status: "draft" as "draft" | "active",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      const trim = (v: string) => v.trim();
      await runSensitive({
        actionLabel: t("ldap.stepUp.create"),
        run: () =>
          createM.mutateAsync({
            ...value,
            name: trim(value.name),
            server_url: trim(value.server_url),
            bind_dn: trim(value.bind_dn),
            base_dn: trim(value.base_dn),
            user_filter: trim(value.user_filter),
            email_attribute: trim(value.email_attribute),
            name_attribute: trim(value.name_attribute),
          }),
      })
        .then((created) => created && onDone())
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
        <SheetTitle>{t("ldap.create.title")}</SheetTitle>
        <SheetDescription>{t("ldap.create.description")}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <form.AppField name="name">
            {(field) => (
              <field.TextField label={t("ldap.create.nameLabel")} placeholder="Corp AD" required />
            )}
          </form.AppField>
          <form.AppField name="server_url">
            {(field) => (
              <field.TextField
                label={t("ldap.create.serverLabel")}
                description={t("ldap.create.serverHelp")}
                placeholder="ldaps://ldap.corp.example.com:636"
                className="font-mono text-xs"
                required
              />
            )}
          </form.AppField>
          <form.AppField name="bind_dn">
            {(field) => (
              <field.TextField
                label={t("ldap.create.bindDnLabel")}
                placeholder="cn=qeetid-svc,ou=ServiceAccounts,dc=corp,dc=example,dc=com"
                className="font-mono text-xs"
                required
              />
            )}
          </form.AppField>
          <form.AppField name="bind_password">
            {(field) => (
              <field.PasswordField
                label={t("ldap.create.bindPasswordLabel")}
                description={t("ldap.create.bindPasswordHelp")}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            )}
          </form.AppField>
          <form.AppField name="base_dn">
            {(field) => (
              <field.TextField
                label={t("ldap.create.baseDnLabel")}
                placeholder="ou=People,dc=corp,dc=example,dc=com"
                className="font-mono text-xs"
                required
              />
            )}
          </form.AppField>
          <form.AppField name="user_filter">
            {(field) => (
              <field.TextField
                label={t("ldap.create.filterLabel")}
                description={t("ldap.create.filterHelp")}
                placeholder="(uid=%s)"
                className="font-mono text-xs"
              />
            )}
          </form.AppField>
          <div className="grid grid-cols-2 gap-3">
            <form.AppField name="email_attribute">
              {(field) => (
                <field.TextField label={t("ldap.create.emailAttrLabel")} placeholder="mail" />
              )}
            </form.AppField>
            <form.AppField name="name_attribute">
              {(field) => (
                <field.TextField label={t("ldap.create.nameAttrLabel")} placeholder="cn" />
              )}
            </form.AppField>
          </div>
          <form.AppField name="start_tls">
            {(field) => (
              <field.SwitchField
                label={t("ldap.create.startTlsLabel")}
                description={t("ldap.create.startTlsHelp")}
              />
            )}
          </form.AppField>
          <form.AppField name="skip_tls_verify">
            {(field) => (
              <field.SwitchField
                label={t("ldap.create.skipVerifyLabel")}
                description={t("ldap.create.skipVerifyHelp")}
              />
            )}
          </form.AppField>
          <form.AppField name="status">
            {(field) => (
              <field.SelectField
                label={t("ldap.create.statusLabel")}
                options={[
                  { value: "draft", label: t("ldap.create.statusDraft") },
                  { value: "active", label: t("ldap.create.statusActive") },
                ]}
              />
            )}
          </form.AppField>
          <FormError error={createM.error} />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("ldap.create.cancelBtn")}
        </SheetClose>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("ldap.create.creatingBtn")}>
            {t("ldap.create.createBtn")}
          </form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}
