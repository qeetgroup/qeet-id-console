import { FileCheckIcon, PlusIcon } from "@qeetrix/icons";
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  Field,
  Textarea,
  TextField,
} from "@qeetrix/react";
import { Alert, FileUpload } from "@qeetrix/react/experimental";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import {
  type SamlConnection,
  useCreateSamlConnection,
  useUpdateSamlConnection,
} from "@/modules/authentication/api/saml";
import { readCertificate } from "@/modules/authentication/certificate-model";
import { fieldError } from "@/modules/authentication/components/connections/form-parts";
import {
  parseSamlMetadata,
  type SamlMetadataProblem,
} from "@/modules/authentication/saml-metadata";
import { ErrorReference } from "@/platform/components/error-reference";
import { errorMessage } from "@/platform/errors/user-message";
import { applyServerErrors, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

/** A metadata file, at most: IdP metadata is a few kilobytes. */
const METADATA_MAX = 1_000_000;

type Values = {
  name: string;
  idp_entity_id: string;
  idp_sso_url: string;
  idp_certificate: string;
  email_attribute: string;
  name_attribute: string;
};

const NEW: Values = {
  name: "",
  idp_entity_id: "",
  idp_sso_url: "",
  idp_certificate: "",
  email_attribute: "email",
  name_attribute: "name",
};

export type SamlDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this connection; without it, the drawer makes a new one, as a draft. */
  connection?: SamlConnection;
};

/**
 * New connection, and Edit connection: the identity provider's name and its details, read from
 * its metadata (a file or pasted, read in the browser: nothing is uploaded and no URL is fetched)
 * or typed in, and the attributes that become a person's email and name. The server needs an
 * https sign-in URL and a certificate it can read before it makes a connection, so Qeet ID's own
 * details (the ACS URL and entity ID, which carry the connection's ID) come on its page after.
 */
export function SamlDrawer({ open, onOpenChange, connection }: SamlDrawerProps) {
  const { t } = useTranslation("saml");
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        size="md"
        title={connection ? t("drawer.editTitle", { name: connection.name }) : t("drawer.title")}
        description={connection ? t("drawer.editDescription") : t("drawer.description")}
      >
        {open ? (
          <SamlForm
            key={connection?.id ?? "new"}
            connection={connection}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function SamlForm({ connection, onDone }: { connection?: SamlConnection; onDone: () => void }) {
  const { t } = useTranslation("saml");
  const navigate = useNavigate();
  const runSensitive = useSensitiveAction();
  const createM = useCreateSamlConnection();
  const updateM = useUpdateSamlConnection({ inline: true });
  const [failure, setFailure] = useState<unknown>(null);
  const [xml, setXml] = useState("");
  const [imported, setImported] = useState<string | null>(null);
  const [problem, setProblem] = useState<SamlMetadataProblem | "tooLarge" | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("drawer.required.name")),
        idp_entity_id: z.string().trim().min(1, t("drawer.required.entityId")),
        // The server's rule: an absolute https URL with a host and no user name.
        idp_sso_url: z
          .string()
          .trim()
          .refine((v) => {
            try {
              const u = new URL(v);
              return u.protocol === "https:" && !!u.hostname && !u.username;
            } catch {
              return false;
            }
          }, t("drawer.required.ssoUrl")),
        idp_certificate: z
          .string()
          .trim()
          .refine((v) => readCertificate(v) !== null, t("drawer.required.certificate")),
        email_attribute: z.string(),
        name_attribute: z.string(),
      }),
    [t],
  );

  const form = useAppForm({
    defaultValues: connection
      ? {
          name: connection.name,
          idp_entity_id: connection.idp_entity_id,
          idp_sso_url: connection.idp_sso_url,
          idp_certificate: connection.idp_certificate,
          email_attribute: connection.email_attribute,
          name_attribute: connection.name_attribute,
        }
      : NEW,
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      setFailure(null);
      const body = {
        name: value.name.trim(),
        idp_entity_id: value.idp_entity_id.trim(),
        idp_sso_url: value.idp_sso_url.trim(),
        idp_certificate: value.idp_certificate.trim(),
        email_attribute: value.email_attribute.trim(),
        name_attribute: value.name_attribute.trim(),
      };
      await runSensitive({
        capability: "connection.write",
        actionLabel: connection ? t("drawer.saveAction") : t("drawer.createAction"),
        run: () =>
          connection
            ? updateM.mutateAsync({ id: connection.id, ...body })
            : createM.mutateAsync({ ...body, status: "draft" }),
      })
        .then((saved) => {
          if (!saved) return;
          onDone();
          if (connection) toast.success(t("drawer.saved", { name: saved.name }));
          else void navigate({ to: "/auth/connections/saml/$id", params: { id: saved.id } });
        })
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
          setFailure(err);
        });
    },
  });

  function read(source: string) {
    const result = parseSamlMetadata(source);
    if (!result.ok) {
      setProblem(result.reason);
      setImported(null);
      return;
    }
    setProblem(null);
    setImported(result.metadata.entityId);
    form.setFieldValue("idp_entity_id", result.metadata.entityId);
    form.setFieldValue("idp_sso_url", result.metadata.ssoUrl);
    form.setFieldValue("idp_certificate", result.metadata.certificate);
  }

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
                label={t("drawer.name")}
                description={t("drawer.nameHint")}
                placeholder={t("drawer.namePlaceholder")}
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v)}
                onBlur={field.handleBlur}
                error={fieldError(field)}
                autoComplete="off"
              />
            )}
          </form.Field>

          <Field
            label={t("drawer.metadata")}
            optional
            description={t("drawer.metadataHint")}
            error={problem ? t(`drawer.metadataProblem.${problem}`) : undefined}
          >
            <FileUpload
              accept=".xml,text/xml,application/xml"
              maxSize={METADATA_MAX}
              hint={t("drawer.metadataFile")}
              onSelect={(files) => {
                const file = files[0];
                if (!file) return;
                if (file.size > METADATA_MAX) return setProblem("tooLarge");
                void file.text().then((text) => {
                  setXml(text);
                  read(text);
                });
              }}
            />
          </Field>
          <Field label={t("drawer.metadataPaste")} optional>
            <Textarea
              rows={3}
              maxRows={8}
              value={xml}
              onValueChange={setXml}
              placeholder="<EntityDescriptor entityID=…>"
              spellCheck={false}
            />
          </Field>
          <span className="cx-inline">
            <Button
              type="button"
              variant="soft"
              tone="neutral"
              size="sm"
              icon={FileCheckIcon}
              disabled={!xml.trim()}
              onClick={() => read(xml)}
            >
              {t("drawer.readMetadata")}
            </Button>
            {imported ? (
              <span className="cx-none">{t("drawer.metadataRead", { entity: imported })}</span>
            ) : null}
          </span>

          <form.Field name="idp_sso_url">
            {(field) => (
              <TextField
                label={t("drawer.ssoUrl")}
                description={t("drawer.ssoUrlHint")}
                placeholder="https://acme.okta.com/app/…/sso/saml"
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v)}
                onBlur={field.handleBlur}
                error={fieldError(field)}
                spellCheck={false}
                autoComplete="off"
              />
            )}
          </form.Field>
          <form.Field name="idp_entity_id">
            {(field) => (
              <TextField
                label={t("drawer.entityId")}
                description={t("drawer.entityIdHint")}
                placeholder="http://www.okta.com/exk1abc"
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v)}
                onBlur={field.handleBlur}
                error={fieldError(field)}
                spellCheck={false}
                autoComplete="off"
              />
            )}
          </form.Field>
          <form.Field name="idp_certificate">
            {(field) => (
              <Field
                label={t("drawer.certificate")}
                description={t("drawer.certificateHint")}
                error={fieldError(field)}
              >
                <Textarea
                  rows={4}
                  maxRows={10}
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v)}
                  onBlur={field.handleBlur}
                  placeholder={"-----BEGIN CERTIFICATE-----\nMIID…\n-----END CERTIFICATE-----"}
                  spellCheck={false}
                />
              </Field>
            )}
          </form.Field>
          <div className="cx-pair">
            <form.Field name="email_attribute">
              {(field) => (
                <TextField
                  label={t("drawer.emailAttribute")}
                  description={t("drawer.emailAttributeHint")}
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
                  label={t("drawer.nameAttribute")}
                  description={t("drawer.nameAttributeHint")}
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
        </div>
      </DrawerBody>
      <DrawerFooter>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(busy) => (
            <>
              <Button type="button" variant="ghost" disabled={busy} onClick={onDone}>
                {t("drawer.cancel")}
              </Button>
              <Button type="submit" icon={connection ? undefined : PlusIcon} loading={busy}>
                {connection ? t("drawer.save") : t("drawer.create")}
              </Button>
            </>
          )}
        </form.Subscribe>
      </DrawerFooter>
    </form>
  );
}
