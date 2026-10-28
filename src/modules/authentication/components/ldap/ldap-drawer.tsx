import { PlusIcon } from "@qeetrix/icons";
import {
  Button,
  Checkbox,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  Field,
  Select,
  TextField,
} from "@qeetrix/react";
import { Alert, PasswordInput } from "@qeetrix/react/experimental";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import type { LdapConnection, LdapStatus } from "@/modules/authentication/api/ldap";
import {
  useCreateLdapConnection,
  useUpdateLdapConnection,
} from "@/modules/authentication/api/ldap-actions";
import { fieldError } from "@/modules/authentication/components/connections/form-parts";
import { ErrorReference } from "@/platform/components/error-reference";
import { errorMessage } from "@/platform/errors/user-message";
import { applyServerErrors, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

type Values = {
  name: string;
  server_url: string;
  start_tls: boolean;
  skip_tls_verify: boolean;
  bind_dn: string;
  bind_password: string;
  base_dn: string;
  user_filter: string;
  email_attribute: string;
  name_attribute: string;
  status: LdapStatus;
};

// The server's defaults for what a new connection leaves out (internal/federation/ldap).
const NEW: Values = {
  name: "",
  server_url: "",
  start_tls: false,
  skip_tls_verify: false,
  bind_dn: "",
  bind_password: "",
  base_dn: "",
  user_filter: "(uid=%s)",
  email_attribute: "mail",
  name_attribute: "cn",
  status: "draft",
};

const valuesOf = (c: LdapConnection): Values => ({
  name: c.name,
  server_url: c.server_url,
  start_tls: c.start_tls,
  skip_tls_verify: c.skip_tls_verify,
  bind_dn: c.bind_dn,
  bind_password: "",
  base_dn: c.base_dn,
  user_filter: c.user_filter,
  email_attribute: c.email_attribute,
  name_attribute: c.name_attribute,
  status: c.status,
});

export type LdapDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this connection; without it, the drawer connects a new directory. */
  connection?: LdapConnection;
};

/**
 * New connection, and Edit connection: one drawer with every field the server takes. A new
 * connection starts as a draft unless it's turned on here; the service account's password is
 * needed to make one and, once saved, is kept encrypted and never shown again, so an edit leaves
 * it empty to keep it. Saving asks the person to confirm it's them.
 */
export function LdapDrawer({ open, onOpenChange, connection }: LdapDrawerProps) {
  const { t } = useTranslation("connections");
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        size="md"
        title={
          connection
            ? t("ldap.drawer.editTitle", { name: connection.name })
            : t("ldap.drawer.title")
        }
        description={connection ? t("ldap.drawer.editDescription") : t("ldap.drawer.description")}
      >
        {open ? (
          <LdapForm
            key={connection?.id ?? "new"}
            connection={connection}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function LdapForm({ connection, onDone }: { connection?: LdapConnection; onDone: () => void }) {
  const { t } = useTranslation("connections");
  const navigate = useNavigate();
  const runSensitive = useSensitiveAction();
  const createM = useCreateLdapConnection();
  const updateM = useUpdateLdapConnection({ inline: true });
  const [failure, setFailure] = useState<unknown>(null);

  const schema = useMemo(() => {
    const required = (key: "name" | "bindDn" | "baseDn") =>
      z
        .string()
        .trim()
        .min(1, t(`ldap.drawer.required.${key}`));
    return z.object({
      name: required("name"),
      // The server takes ldap:// or ldaps:// to a public host.
      server_url: z
        .string()
        .trim()
        .regex(/^ldaps?:\/\/[^\s/]+/i, t("ldap.drawer.required.serverUrl")),
      start_tls: z.boolean(),
      skip_tls_verify: z.boolean(),
      bind_dn: required("bindDn"),
      bind_password: connection
        ? z.string()
        : z.string().min(1, t("ldap.drawer.required.bindPassword")),
      base_dn: required("baseDn"),
      user_filter: z
        .string()
        .trim()
        .refine((v) => v === "" || v.includes("%s"), t("ldap.drawer.required.filter")),
      email_attribute: z.string(),
      name_attribute: z.string(),
      status: z.enum(["draft", "active", "disabled"]),
    });
  }, [t, connection]);

  const form = useAppForm({
    defaultValues: connection ? valuesOf(connection) : NEW,
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      setFailure(null);
      const trim = (v: string) => v.trim();
      const body = {
        name: trim(value.name),
        server_url: trim(value.server_url),
        // StartTLS upgrades a plain ldap:// connection; ldaps:// is TLS from the start.
        start_tls: value.server_url.trim().toLowerCase().startsWith("ldap://") && value.start_tls,
        skip_tls_verify: value.skip_tls_verify,
        bind_dn: trim(value.bind_dn),
        base_dn: trim(value.base_dn),
        user_filter: trim(value.user_filter),
        email_attribute: trim(value.email_attribute),
        name_attribute: trim(value.name_attribute),
      };
      await runSensitive({
        capability: "connection.write",
        actionLabel: connection ? t("ldap.drawer.saveAction") : t("ldap.drawer.createAction"),
        run: () =>
          connection
            ? updateM.mutateAsync({
                id: connection.id,
                ...body,
                ...(value.bind_password ? { bind_password: value.bind_password } : {}),
              })
            : createM.mutateAsync({
                ...body,
                bind_password: value.bind_password,
                status: value.status,
              }),
      })
        .then((saved) => {
          if (!saved) return;
          onDone();
          if (connection) toast.success(t("ldap.drawer.saved", { name: saved.name }));
          else
            void navigate({
              to: "/directory/connections/ldap/$id",
              params: { id: saved.id },
            });
        })
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
          setFailure(err);
        });
    },
  });

  return (
    <form
      className="cx-drawer-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <DrawerBody>
        <div className="sub-form">
          {failure ? (
            <Alert tone="danger" title={errorMessage(failure)}>
              <ErrorReference error={failure} />
            </Alert>
          ) : null}
          <form.Field name="name">
            {(field) => (
              <TextField
                label={t("ldap.drawer.name")}
                description={t("ldap.drawer.nameHint")}
                placeholder={t("ldap.drawer.namePlaceholder")}
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v)}
                onBlur={field.handleBlur}
                error={fieldError(field)}
                autoComplete="off"
              />
            )}
          </form.Field>
          <form.Field name="server_url">
            {(field) => (
              <TextField
                label={t("ldap.drawer.serverUrl")}
                description={t("ldap.drawer.serverUrlHint")}
                placeholder="ldaps://ldap.corp.example.com:636"
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v)}
                onBlur={field.handleBlur}
                error={fieldError(field)}
                spellCheck={false}
                autoComplete="off"
              />
            )}
          </form.Field>
          <form.Subscribe selector={(s) => s.values.server_url.trim().toLowerCase()}>
            {(url) => (
              <form.Field name="start_tls">
                {(field) => (
                  <Checkbox
                    label={t("ldap.drawer.startTls")}
                    description={
                      url.startsWith("ldaps://")
                        ? t("ldap.drawer.startTlsLdaps")
                        : t("ldap.drawer.startTlsHint")
                    }
                    disabled={url.startsWith("ldaps://")}
                    checked={field.state.value && !url.startsWith("ldaps://")}
                    onCheckedChange={(on) => field.handleChange(on === true)}
                  />
                )}
              </form.Field>
            )}
          </form.Subscribe>
          <form.Field name="skip_tls_verify">
            {(field) => (
              <Checkbox
                label={t("ldap.drawer.skipVerify")}
                description={t("ldap.drawer.skipVerifyHint")}
                checked={field.state.value}
                onCheckedChange={(on) => field.handleChange(on === true)}
              />
            )}
          </form.Field>
          <form.Field name="bind_dn">
            {(field) => (
              <TextField
                label={t("ldap.drawer.bindDn")}
                description={t("ldap.drawer.bindDnHint")}
                placeholder="cn=qeet-id,ou=service,dc=corp,dc=example,dc=com"
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v)}
                onBlur={field.handleBlur}
                error={fieldError(field)}
                spellCheck={false}
                autoComplete="off"
              />
            )}
          </form.Field>
          <form.Field name="bind_password">
            {(field) => (
              <Field
                label={t("ldap.drawer.bindPassword")}
                optional={!!connection}
                description={
                  connection ? t("ldap.drawer.bindPasswordKeep") : t("ldap.drawer.bindPasswordHint")
                }
                error={fieldError(field)}
              >
                <PasswordInput
                  autoComplete="new-password"
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v)}
                  onBlur={field.handleBlur}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="base_dn">
            {(field) => (
              <TextField
                label={t("ldap.drawer.baseDn")}
                description={t("ldap.drawer.baseDnHint")}
                placeholder="ou=people,dc=corp,dc=example,dc=com"
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v)}
                onBlur={field.handleBlur}
                error={fieldError(field)}
                spellCheck={false}
                autoComplete="off"
              />
            )}
          </form.Field>
          <form.Field name="user_filter">
            {(field) => (
              <TextField
                label={t("ldap.drawer.filter")}
                description={t("ldap.drawer.filterHint")}
                placeholder="(uid=%s)"
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v)}
                onBlur={field.handleBlur}
                error={fieldError(field)}
                spellCheck={false}
                autoComplete="off"
              />
            )}
          </form.Field>
          <div className="cx-pair">
            <form.Field name="email_attribute">
              {(field) => (
                <TextField
                  label={t("ldap.drawer.emailAttribute")}
                  description={t("ldap.drawer.emailAttributeHint")}
                  placeholder="mail"
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v)}
                  onBlur={field.handleBlur}
                  error={fieldError(field)}
                  spellCheck={false}
                  autoComplete="off"
                />
              )}
            </form.Field>
            <form.Field name="name_attribute">
              {(field) => (
                <TextField
                  label={t("ldap.drawer.nameAttribute")}
                  description={t("ldap.drawer.nameAttributeHint")}
                  placeholder="cn"
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v)}
                  onBlur={field.handleBlur}
                  error={fieldError(field)}
                  spellCheck={false}
                  autoComplete="off"
                />
              )}
            </form.Field>
          </div>
          {connection ? null : (
            <form.Field name="status">
              {(field) => (
                <Field
                  label={t("ldap.drawer.status")}
                  description={
                    field.state.value === "active"
                      ? t("ldap.drawer.statusOnHint")
                      : t("ldap.drawer.statusDraftHint")
                  }
                >
                  <Select<string>
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange((v ?? "draft") as LdapStatus)}
                    items={[
                      { value: "draft", label: t("ldap.drawer.statusDraft") },
                      { value: "active", label: t("ldap.drawer.statusOn") },
                    ]}
                  />
                </Field>
              )}
            </form.Field>
          )}
        </div>
      </DrawerBody>
      <DrawerFooter>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(busy) => (
            <>
              <Button type="button" variant="ghost" disabled={busy} onClick={onDone}>
                {t("parts.cancel")}
              </Button>
              <Button type="submit" icon={connection ? undefined : PlusIcon} loading={busy}>
                {connection ? t("ldap.drawer.save") : t("ldap.drawer.create")}
              </Button>
            </>
          )}
        </form.Subscribe>
      </DrawerFooter>
    </form>
  );
}
