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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  CheckCircle2Icon,
  Loader2Icon,
  PencilLineIcon,
  PlayIcon,
  UploadIcon,
  UserRoundIcon,
  XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { DOCS_URL } from "@/platform/config/site-urls";
import { errorMessage } from "@/platform/errors/user-message";

import { type SamlStatus, useCreateSamlConnection } from "../api/saml";
import { type SamlMetadataProblem, parseSamlMetadata } from "../saml-metadata";

const SETUP_GUIDE_URL = `${DOCS_URL}/docs/guides/add-enterprise-sso`;

type Mode = "manual" | "import";

type FormState = {
  name: string;
  idpEntityId: string;
  idpSsoUrl: string;
  idpCertificate: string;
  emailAttribute: string;
  nameAttribute: string;
  status: SamlStatus;
};

const EMPTY_FORM: FormState = {
  name: "",
  idpEntityId: "",
  idpSsoUrl: "",
  idpCertificate: "",
  emailAttribute: "email",
  nameAttribute: "displayName",
  status: "draft",
};

type ValueCheck = { id: string; ok: boolean; detail?: string };

/** Strips PEM armour and whitespace so a pasted certificate can be decoded. */
function certificateBody(raw: string): string {
  return raw
    .replace(/-----(BEGIN|END)[^-]*-----/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/**
 * The same shape of offline checks the server runs in `POST /saml/{id}/test`,
 * but against values that have no connection row yet — that endpoint needs an
 * id, so before creation the browser is the only thing that can look at these.
 * It is feedback, never a gate: the backend validates again on create.
 */
function checkValues(form: FormState): ValueCheck[] {
  const checks: ValueCheck[] = [];

  checks.push({ id: "name", ok: !!form.name.trim() });
  checks.push({ id: "entityId", ok: !!form.idpEntityId.trim() });

  let ssoOk = false;
  let ssoDetail: string | undefined;
  try {
    const url = new URL(form.idpSsoUrl.trim());
    ssoOk = url.protocol === "https:";
    if (!ssoOk) ssoDetail = url.protocol.replace(":", "");
  } catch {
    ssoOk = false;
  }
  checks.push({ id: "ssoUrl", ok: ssoOk, detail: ssoDetail });

  const body = certificateBody(form.idpCertificate);
  let certOk = false;
  try {
    certOk = body.length > 100 && /^[A-Za-z0-9+/=]+$/.test(body) && !!atob(body);
  } catch {
    certOk = false;
  }
  checks.push({ id: "certificate", ok: certOk });

  return checks;
}

export function SamlConnectionSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation("auth");
  const createM = useCreateSamlConnection();

  const [mode, setMode] = useState<Mode>("manual");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [xml, setXml] = useState("");
  const [importProblem, setImportProblem] = useState<SamlMetadataProblem | null>(null);
  const [imported, setImported] = useState(false);
  const [checks, setChecks] = useState<ValueCheck[] | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setChecks(null);
  };

  const canCreate =
    !!form.name.trim() &&
    !!form.idpEntityId.trim() &&
    !!form.idpSsoUrl.trim() &&
    !!form.idpCertificate.trim() &&
    !createM.isPending;

  function importMetadata(source: string) {
    const result = parseSamlMetadata(source);
    if (!result.ok) {
      setImportProblem(result.reason);
      setImported(false);
      return;
    }
    setImportProblem(null);
    setImported(true);
    setChecks(null);
    setForm((prev) => ({
      ...prev,
      idpEntityId: result.metadata.entityId,
      idpSsoUrl: result.metadata.ssoUrl,
      idpCertificate: result.metadata.certificate,
    }));
    setMode("manual");
  }

  function close() {
    onOpenChange(false);
    // Reset so the next open starts clean rather than on a half-filled IdP.
    setForm(EMPTY_FORM);
    setXml("");
    setMode("manual");
    setImported(false);
    setImportProblem(null);
    setChecks(null);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      {/* The kit caps a right-side sheet at 24rem via a `[data-side=right]`
          rule that outweighs a plain utility — hence the important modifier. */}
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md!">
        <form
          className="flex h-full min-h-0 flex-col"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!canCreate) return;
            createM.mutate(
              {
                name: form.name.trim(),
                idp_entity_id: form.idpEntityId.trim(),
                idp_sso_url: form.idpSsoUrl.trim(),
                idp_certificate: form.idpCertificate.trim(),
                email_attribute: form.emailAttribute.trim(),
                name_attribute: form.nameAttribute.trim(),
                status: form.status,
              },
              { onSuccess: close },
            );
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
                <Field>
                  <FieldLabel htmlFor="saml-name">{t("samlSp.create.nameLabel")}</FieldLabel>
                  <Input
                    id="saml-name"
                    placeholder="Acme — Okta"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                  <FieldDescription>{t("samlSp.create.nameHelp")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="saml-entity-id">
                    {t("samlSp.create.idpEntityIdLabel")}
                  </FieldLabel>
                  <Input
                    id="saml-entity-id"
                    spellCheck={false}
                    placeholder="http://www.okta.com/exk1abc"
                    value={form.idpEntityId}
                    onChange={(e) => set("idpEntityId", e.target.value)}
                  />
                  <FieldDescription>{t("samlSp.create.idpEntityIdHelp")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="saml-sso-url">
                    {t("samlSp.create.idpSsoUrlLabel")}
                  </FieldLabel>
                  <Input
                    id="saml-sso-url"
                    type="url"
                    spellCheck={false}
                    placeholder="https://acme.okta.com/app/.../sso/saml"
                    value={form.idpSsoUrl}
                    onChange={(e) => set("idpSsoUrl", e.target.value)}
                  />
                  <FieldDescription>{t("samlSp.create.idpSsoUrlHelp")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="saml-certificate">
                    {t("samlSp.create.idpCertLabel")}
                  </FieldLabel>
                  <Textarea
                    id="saml-certificate"
                    rows={5}
                    spellCheck={false}
                    className="font-mono text-xs"
                    placeholder={"-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----"}
                    value={form.idpCertificate}
                    onChange={(e) => set("idpCertificate", e.target.value)}
                  />
                  <FieldDescription>{t("samlSp.create.idpCertHelp")}</FieldDescription>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="saml-email-attribute">
                      {t("samlSp.create.emailAttrLabel")}
                    </FieldLabel>
                    <Input
                      id="saml-email-attribute"
                      spellCheck={false}
                      value={form.emailAttribute}
                      onChange={(e) => set("emailAttribute", e.target.value)}
                    />
                    <FieldDescription>{t("samlSp.create.emailAttrHelp")}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="saml-name-attribute">
                      {t("samlSp.create.nameAttrLabel")}
                    </FieldLabel>
                    <Input
                      id="saml-name-attribute"
                      spellCheck={false}
                      value={form.nameAttribute}
                      onChange={(e) => set("nameAttribute", e.target.value)}
                    />
                    <FieldDescription>{t("samlSp.create.nameAttrHelp")}</FieldDescription>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="saml-status">{t("samlSp.create.statusLabel")}</FieldLabel>
                  <Select
                    value={form.status}
                    onValueChange={(v) => v && set("status", v as SamlStatus)}
                  >
                    <SelectTrigger id="saml-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t("samlSp.create.statusDraft")}</SelectItem>
                      <SelectItem value="active">{t("samlSp.create.statusActive")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>{t("samlSp.create.statusHelp")}</FieldDescription>
                </Field>

                <div className="rounded-lg border bg-muted/40 p-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
                      <UserRoundIcon className="size-4" />
                    </span>
                    <div className="min-w-0 text-xs">
                      <p className="font-medium">{t("samlSp.create.mappingTitle")}</p>
                      <p className="mt-0.5 text-muted-foreground">
                        {form.emailAttribute.trim()
                          ? t("samlSp.create.mappingEmail", {
                              attribute: form.emailAttribute.trim(),
                            })
                          : t("samlSp.create.mappingNameId")}
                      </p>
                      <p className="text-muted-foreground">
                        {t("samlSp.create.mappingDisplayName", {
                          attribute: form.nameAttribute.trim() || "—",
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {checks && (
                  <ul className="flex flex-col gap-2 rounded-lg border p-3">
                    {checks.map((check) => (
                      <li key={check.id} className="flex items-start gap-2 text-xs">
                        {check.ok ? (
                          <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0 text-success" />
                        ) : (
                          <XCircleIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                        )}
                        <span className={check.ok ? "" : "text-destructive"}>
                          {t(`samlSp.create.checks.${check.id}${check.ok ? "Ok" : "Failed"}`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {createM.error && (
                  <Field>
                    <FieldError>{errorMessage(createM.error)}</FieldError>
                  </Field>
                )}
              </FieldGroup>
            )}
          </div>

          <SheetFooter className="mt-0 shrink-0 flex-row justify-end gap-2 border-t p-4">
            <Button type="button" variant="outline" onClick={close}>
              {t("samlSp.create.cancelBtn")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setChecks(checkValues(form))}
              disabled={mode === "import"}
            >
              <PlayIcon /> {t("samlSp.create.testValuesBtn")}
            </Button>
            <Button type="submit" disabled={!canCreate}>
              {createM.isPending && <Loader2Icon className="animate-spin" />}
              {createM.isPending ? t("samlSp.create.creatingBtn") : t("samlSp.create.createBtn")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
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
  icon: React.ReactNode;
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
