import {
  Button,
  Callout,
  cn,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@qeetrix/ui";
import {
  ArrowRightIcon,
  CircleCheckIcon,
  CircleXIcon,
  PencilLineIcon,
  PlayIcon,
  UploadIcon,
  UserRoundIcon,
} from "@qeetrix/icons";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { DOCS_URL } from "@/platform/config/site-urls";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

import { type SamlStatus, useCreateSamlConnection } from "../api/saml";
import { type SamlMetadataProblem, parseSamlMetadata } from "../saml-metadata";

const SETUP_GUIDE_URL = `${DOCS_URL}/docs/guides/add-enterprise-sso`;

type Mode = "manual" | "import";

type Values = {
  name: string;
  idp_entity_id: string;
  idp_sso_url: string;
  idp_certificate: string;
  email_attribute: string;
  name_attribute: string;
  status: SamlStatus;
};

const EMPTY: Values = {
  name: "",
  idp_entity_id: "",
  idp_sso_url: "",
  idp_certificate: "",
  email_attribute: "email",
  name_attribute: "displayName",
  status: "draft",
};

type ValueCheck = { id: string; ok: boolean };

/** Strips PEM armour and whitespace so a pasted certificate can be decoded. */
function certificateBody(raw: string): string {
  return raw
    .replace(/-----(BEGIN|END)[^-]*-----/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/**
 * Mirrors in the browser the server's offline connection checks, for values with no connection
 * yet (the test endpoint needs an id). Feedback, never a gate: the server validates on create.
 */
function checkValues(values: Values): ValueCheck[] {
  let ssoOk = false;
  try {
    ssoOk = new URL(values.idp_sso_url.trim()).protocol === "https:";
  } catch {
    ssoOk = false;
  }
  const body = certificateBody(values.idp_certificate);
  let certOk = false;
  try {
    certOk = body.length > 100 && /^[A-Za-z0-9+/=]+$/.test(body) && !!atob(body);
  } catch {
    certOk = false;
  }
  return [
    { id: "name", ok: !!values.name.trim() },
    { id: "entityId", ok: !!values.idp_entity_id.trim() },
    { id: "ssoUrl", ok: ssoOk },
    { id: "certificate", ok: certOk },
  ];
}

/** Renders the sheet that adds a SAML connection, typed in or imported from IdP metadata. */
export function SamlConnectionSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* The kit caps a right-side sheet at 24rem via a `[data-side=right]`
          rule that outweighs a plain utility — hence the important modifier. */}
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md!">
        {open && <SamlConnectionForm onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function SamlConnectionForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation("auth");
  const createM = useCreateSamlConnection();
  const runSensitive = useSensitiveAction();
  const [mode, setMode] = useState<Mode>("manual");
  const [xml, setXml] = useState("");
  const [importProblem, setImportProblem] = useState<SamlMetadataProblem | null>(null);
  const [imported, setImported] = useState(false);
  const [checks, setChecks] = useState<ValueCheck[] | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("samlSp.create.validation.name")),
        idp_entity_id: z.string().trim().min(1, t("samlSp.create.validation.entityId")),
        idp_sso_url: z.url({ protocol: /^https$/, error: t("samlSp.create.validation.ssoUrl") }),
        idp_certificate: z.string().trim().min(1, t("samlSp.create.validation.certificate")),
        email_attribute: z.string(),
        name_attribute: z.string(),
        status: z.enum(["draft", "active", "disabled"]),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: EMPTY,
    validators: { onSubmit: schema },
    // A changed value makes the last check stale.
    listeners: { onChange: () => setChecks(null) },
    onSubmitInvalid: () => setMode("manual"),
    onSubmit: async ({ value, formApi }) => {
      await runSensitive({
        actionLabel: t("samlSp.stepUp.create"),
        run: () =>
          createM.mutateAsync({
            name: value.name.trim(),
            idp_entity_id: value.idp_entity_id.trim(),
            idp_sso_url: value.idp_sso_url.trim(),
            idp_certificate: value.idp_certificate.trim(),
            email_attribute: value.email_attribute.trim(),
            name_attribute: value.name_attribute.trim(),
            status: value.status,
          }),
      })
        .then((created) => created && onDone())
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  function importMetadata(source: string) {
    const result = parseSamlMetadata(source);
    if (!result.ok) {
      setImportProblem(result.reason);
      setImported(false);
      return;
    }
    setImportProblem(null);
    setImported(true);
    form.setFieldValue("idp_entity_id", result.metadata.entityId);
    form.setFieldValue("idp_sso_url", result.metadata.ssoUrl);
    form.setFieldValue("idp_certificate", result.metadata.certificate);
    setMode("manual");
  }

  return (
    <form
      className="flex h-full min-h-0 flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <SheetHeader className="gap-1 border-b p-5 pe-12">
        <SheetTitle className="text-base">{t("samlSp.create.title")}</SheetTitle>
        <SheetDescription>{t("samlSp.create.description")}</SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeTile
            icon={<PencilLineIcon className="size-4" />}
            title={t("samlSp.create.manualMode")}
            subtitle={t("samlSp.create.manualModeHint")}
            selected={mode === "manual"}
            onSelect={() => setMode("manual")}
          />
          <ModeTile
            icon={<UploadIcon className="size-4" />}
            title={t("samlSp.create.importMode")}
            subtitle={t("samlSp.create.importModeHint")}
            selected={mode === "import"}
            onSelect={() => setMode("import")}
          />
        </div>

        <Callout variant="info" className="text-xs">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium">{t("samlSp.create.commonProvidersTitle")}</p>
              <p className="mt-0.5">{t("samlSp.create.commonProvidersBody")}</p>
            </div>
            <a
              href={SETUP_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline"
            >
              {t("samlSp.create.setupGuidesLink")} <ArrowRightIcon className="size-3" />
            </a>
          </div>
        </Callout>

        {mode === "import" ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="saml-metadata-file">
                {t("samlSp.create.metadataFileLabel")}
              </FieldLabel>
              <Input
                id="saml-metadata-file"
                type="file"
                accept=".xml,text/xml,application/xml"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  setXml(text);
                  importMetadata(text);
                }}
              />
              <FieldDescription>{t("samlSp.create.metadataFileHelp")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="saml-metadata-xml">
                {t("samlSp.create.metadataPasteLabel")}
              </FieldLabel>
              <Textarea
                id="saml-metadata-xml"
                rows={8}
                className="font-mono text-xs"
                placeholder="<EntityDescriptor entityID=…>"
                value={xml}
                onChange={(e) => setXml(e.target.value)}
              />
              <FieldDescription>{t("samlSp.create.metadataPasteHelp")}</FieldDescription>
            </Field>
            {importProblem && (
              <Field>
                <FieldError>{t(`samlSp.create.importProblem.${importProblem}`)}</FieldError>
              </Field>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={!xml.trim()}
              onClick={() => importMetadata(xml)}
            >
              <UploadIcon /> {t("samlSp.create.importBtn")}
            </Button>
          </FieldGroup>
        ) : (
          <FieldGroup>
            {imported && (
              <Callout variant="success" className="text-xs">
                {t("samlSp.create.importedNotice")}
              </Callout>
            )}
            <form.AppField name="name">
              {(field) => (
                <field.TextField
                  label={t("samlSp.create.nameLabel")}
                  description={t("samlSp.create.nameHelp")}
                  placeholder="Acme — Okta"
                  required
                />
              )}
            </form.AppField>
            <form.AppField name="idp_entity_id">
              {(field) => (
                <field.TextField
                  label={t("samlSp.create.idpEntityIdLabel")}
                  description={t("samlSp.create.idpEntityIdHelp")}
                  placeholder="http://www.okta.com/exk1abc"
                  spellCheck={false}
                  required
                />
              )}
            </form.AppField>
            <form.AppField name="idp_sso_url">
              {(field) => (
                <field.TextField
                  label={t("samlSp.create.idpSsoUrlLabel")}
                  description={t("samlSp.create.idpSsoUrlHelp")}
                  placeholder="https://acme.okta.com/app/.../sso/saml"
                  type="url"
                  spellCheck={false}
                  required
                />
              )}
            </form.AppField>
            <form.AppField name="idp_certificate">
              {(field) => (
                <field.TextareaField
                  label={t("samlSp.create.idpCertLabel")}
                  description={t("samlSp.create.idpCertHelp")}
                  placeholder={"-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----"}
                  rows={5}
                  spellCheck={false}
                  className="font-mono text-xs"
                  required
                />
              )}
            </form.AppField>
            <div className="grid gap-4 sm:grid-cols-2">
              <form.AppField name="email_attribute">
                {(field) => (
                  <field.TextField
                    label={t("samlSp.create.emailAttrLabel")}
                    description={t("samlSp.create.emailAttrHelp")}
                    spellCheck={false}
                  />
                )}
              </form.AppField>
              <form.AppField name="name_attribute">
                {(field) => (
                  <field.TextField
                    label={t("samlSp.create.nameAttrLabel")}
                    description={t("samlSp.create.nameAttrHelp")}
                    spellCheck={false}
                  />
                )}
              </form.AppField>
            </div>
            <form.AppField name="status">
              {(field) => (
                <field.SelectField
                  label={t("samlSp.create.statusLabel")}
                  description={t("samlSp.create.statusHelp")}
                  options={[
                    { value: "draft", label: t("samlSp.create.statusDraft") },
                    { value: "active", label: t("samlSp.create.statusActive") },
                  ]}
                />
              )}
            </form.AppField>

            <form.Subscribe
              selector={(state) => [state.values.email_attribute, state.values.name_attribute]}
            >
              {([emailAttribute = "", nameAttribute = ""]) => (
                <AttributeMapping
                  emailAttribute={emailAttribute.trim()}
                  nameAttribute={nameAttribute.trim()}
                />
              )}
            </form.Subscribe>

            {checks && (
              <ul className="flex flex-col gap-2 rounded-lg border p-3">
                {checks.map((check) => (
                  <li key={check.id} className="flex items-start gap-2 text-xs">
                    {check.ok ? (
                      <CircleCheckIcon className="mt-0.5 size-3.5 shrink-0 text-success" />
                    ) : (
                      <CircleXIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                    )}
                    <span className={check.ok ? "" : "text-destructive"}>
                      {t(`samlSp.create.checks.${check.id}${check.ok ? "Ok" : "Failed"}`)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <FormError error={createM.error} />
          </FieldGroup>
        )}
      </div>

      <SheetFooter className="mt-0 shrink-0 flex-row justify-end gap-2 border-t p-4">
        <Button type="button" variant="outline" onClick={onDone}>
          {t("samlSp.create.cancelBtn")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setChecks(checkValues(form.state.values))}
          disabled={mode === "import"}
        >
          <PlayIcon /> {t("samlSp.create.testValuesBtn")}
        </Button>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("samlSp.create.creatingBtn")}>
            {t("samlSp.create.createBtn")}
          </form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}

// How the IdP's assertion maps onto the new account.
function AttributeMapping({
  emailAttribute,
  nameAttribute,
}: {
  emailAttribute: string;
  nameAttribute: string;
}) {
  const { t } = useTranslation("auth");
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
          <UserRoundIcon className="size-4" />
        </span>
        <div className="min-w-0 text-xs">
          <p className="font-medium">{t("samlSp.create.mappingTitle")}</p>
          <p className="mt-0.5 text-muted-foreground">
            {emailAttribute
              ? t("samlSp.create.mappingEmail", { attribute: emailAttribute })
              : t("samlSp.create.mappingNameId")}
          </p>
          <p className="text-muted-foreground">
            {t("samlSp.create.mappingDisplayName", { attribute: nameAttribute || "—" })}
          </p>
        </div>
      </div>
    </div>
  );
}

/** One of the two entry paths — manual entry or an IdP metadata import. */
function ModeTile({
  icon,
  title,
  subtitle,
  selected,
  onSelect,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3 text-start transition-colors",
        selected ? "border-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/40",
      )}
    >
      <span className={cn("mt-0.5 shrink-0", selected ? "text-primary" : "text-muted-foreground")}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  );
}
