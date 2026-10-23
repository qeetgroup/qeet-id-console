import { cn, Field, FieldError, FieldLabel, Input, StatusPill } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { ArrowUpRightIcon, ImageIcon, InfoIcon, LinkIcon, MailIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import type { LoginDomainStatus, TenantDomain } from "@/modules/organizations";
import { LogoField, type LogoStatus } from "@/shared/components/logo-field";
import type { Branding, BrandingDraft, BrandingErrors } from "../branding-model";

const PANEL =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 p-3.5 shadow-xs dark:bg-card/70 dark:shadow-none";
const INPUT =
  "h-8 min-w-0 rounded-md bg-muted/15 text-xs pointer-coarse:min-h-11 pointer-coarse:text-base";

/** What every form section needs to edit and validate its fields. */
export type BrandingFields = {
  id: string;
  draft: BrandingDraft;
  touched: Partial<Record<keyof BrandingDraft, boolean>>;
  errors: BrandingErrors;
  onChange: <Key extends keyof BrandingDraft>(key: Key, value: BrandingDraft[Key]) => void;
  onTouch: (key: keyof BrandingDraft) => void;
};

type TextKey = "custom_domain" | "email_from_name" | "email_from_address" | "email_reply_to";

/** A field's validation message, shown once the field has been touched. */
export function BrandingFieldError({
  fields,
  name,
}: {
  fields: BrandingFields;
  name: keyof BrandingDraft;
}) {
  const { t } = useTranslation("settings");
  const error = fields.errors[name];
  return fields.touched[name] && error ? (
    <FieldError id={`${fields.id}-${name}-error`}>
      {t(`branding.workspace.validation.${error}`)}
    </FieldError>
  ) : null;
}

function BrandingTextField({
  fields,
  name,
  placeholder,
}: {
  fields: BrandingFields;
  name: TextKey;
  placeholder?: string;
}) {
  const { t } = useTranslation("settings");
  const { id, draft, touched, errors } = fields;
  return (
    <Field>
      <FieldLabel htmlFor={`${id}-${name}`}>{t(`branding.workspace.fields.${name}`)}</FieldLabel>
      <Input
        id={`${id}-${name}`}
        name={name}
        type={name === "email_from_address" || name === "email_reply_to" ? "email" : "text"}
        value={draft[name]}
        onChange={(event) => fields.onChange(name, event.target.value)}
        onBlur={() => fields.onTouch(name)}
        aria-invalid={!!(touched[name] && errors[name])}
        aria-describedby={touched[name] && errors[name] ? `${id}-${name}-error` : undefined}
        placeholder={placeholder}
        className={INPUT}
        maxLength={name === "email_from_name" ? 128 : 254}
      />
      <BrandingFieldError fields={fields} name={name} />
    </Field>
  );
}

export function BrandingIdentitySection({
  id,
  logo,
  invalid,
  disabled,
  onChange,
  onStatusChange,
}: {
  id: string;
  logo: string;
  invalid: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onStatusChange: (status: LogoStatus) => void;
}) {
  const { t } = useTranslation("settings");
  return (
    <section className={PANEL} aria-labelledby={`${id}-identity`}>
      <h2
        id={`${id}-identity`}
        className="flex items-center gap-2 font-heading text-sm font-semibold"
      >
        <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        {t("branding.workspace.identity.title")}
      </h2>
      <p className="mb-3 mt-1 text-[11px] leading-4 text-muted-foreground">
        {t("branding.workspace.identity.description")}
      </p>
      <LogoField
        value={logo}
        onChange={onChange}
        onStatusChange={onStatusChange}
        disabled={disabled}
        layout="split"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        maxSizeMB={2}
        hint={t("branding.workspace.identity.hint")}
      />
      {invalid && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {t("branding.workspace.validation.logo")}
        </p>
      )}
    </section>
  );
}

/** The custom login domain, with its verification, TLS and endpoint state once saved. */
export function BrandingDomainSection({
  fields,
  saved,
  domains,
  loginDomain,
  domainsState,
  canManageDomains,
}: {
  fields: BrandingFields;
  saved: Branding;
  domains?: TenantDomain[];
  loginDomain?: LoginDomainStatus;
  domainsState: "ready" | "loading" | "error" | "denied";
  canManageDomains: boolean;
}) {
  const { t } = useTranslation("settings");
  const { id, draft } = fields;
  const savedDomain = saved.custom_domain?.trim().toLowerCase() ?? "";
  const domainChanged = draft.custom_domain.trim().toLowerCase() !== savedDomain;
  const hostStatus =
    !domainChanged && loginDomain?.login_domain.toLowerCase() === savedDomain
      ? loginDomain
      : undefined;
  const verifiedDomain = domains?.find(
    (domain) =>
      domain.domain.toLowerCase() === savedDomain &&
      !!domain.verified_at &&
      Number.isFinite(Date.parse(domain.verified_at)),
  );

  return (
    <section className={PANEL} aria-labelledby={`${id}-domain`}>
      <h2
        id={`${id}-domain`}
        className="flex items-center gap-2 font-heading text-sm font-semibold"
      >
        <LinkIcon className="size-4 text-info" aria-hidden="true" />
        {t("branding.customDomain.title")}
      </h2>
      <p className="mb-3 mt-1 text-[11px] leading-4 text-muted-foreground">
        {t("branding.workspace.domain.description")}
      </p>
      <div className="grid gap-3 @min-[720px]/branding:grid-cols-[1.6fr_1fr]">
        <div>
          <BrandingTextField fields={fields} name="custom_domain" placeholder="auth.example.com" />
          <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">
            {t("branding.workspace.domain.setup")}
          </p>
        </div>
        <div className="flex flex-col items-start justify-between gap-2 @min-[720px]/branding:border-s @min-[720px]/branding:border-border/60 @min-[720px]/branding:ps-3">
          <StatusPill
            kind={
              domainChanged
                ? "warning"
                : !savedDomain || domainsState !== "ready"
                  ? "neutral"
                  : verifiedDomain
                    ? "success"
                    : "warning"
            }
          >
            {t(
              domainChanged
                ? "branding.workspace.domain.unsaved"
                : !savedDomain
                  ? "branding.workspace.domain.notConfigured"
                  : domainsState !== "ready"
                    ? "branding.workspace.domain.unknown"
                    : verifiedDomain
                      ? "branding.workspace.domain.verified"
                      : "branding.workspace.domain.pending",
            )}
          </StatusPill>
          <p
            className={cn(
              "flex items-center gap-1.5 text-[10px]",
              hostStatus?.tls_state === "issued" ? "text-success" : "text-muted-foreground",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full",
                hostStatus?.tls_state === "issued"
                  ? "bg-success"
                  : hostStatus?.tls_state === "pending"
                    ? "bg-warning"
                    : "bg-muted-foreground/60",
              )}
            />
            {t(
              hostStatus
                ? `branding.workspace.domain.tlsStates.${hostStatus.tls_state}`
                : "branding.workspace.domain.tls",
            )}
          </p>
          {hostStatus && (
            <p className="text-[10px] text-muted-foreground">
              {t(
                hostStatus.endpoint_state === "live"
                  ? "branding.workspace.domain.live"
                  : "branding.workspace.domain.notLive",
              )}
            </p>
          )}
          {canManageDomains && (
            <Link
              to="/settings/organization/domains"
              className="inline-flex items-center gap-1 text-[10px] text-info underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {t("branding.workspace.domain.instructions")}
              <ArrowUpRightIcon className="size-3" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export function BrandingEmailSection({ fields }: { fields: BrandingFields }) {
  const { t } = useTranslation("settings");
  return (
    <section className={PANEL} aria-labelledby={`${fields.id}-email`}>
      <h2
        id={`${fields.id}-email`}
        className="flex items-center gap-2 font-heading text-sm font-semibold"
      >
        <MailIcon className="size-4 text-info" aria-hidden="true" />
        {t("branding.workspace.email.title")}
      </h2>
      <p className="mb-3 mt-1 text-[11px] leading-4 text-muted-foreground">
        {t("branding.workspace.email.description")}
      </p>
      <div className="grid gap-3 @min-[720px]/branding:grid-cols-3">
        <BrandingTextField
          fields={fields}
          name="email_from_name"
          placeholder={t("branding.workspace.email.fromNamePlaceholder")}
        />
        <BrandingTextField
          fields={fields}
          name="email_from_address"
          placeholder="noreply@example.com"
        />
        <BrandingTextField
          fields={fields}
          name="email_reply_to"
          placeholder="support@example.com"
        />
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-4 text-muted-foreground">
        <InfoIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        {t("branding.workspace.email.providerNote")}
      </p>
    </section>
  );
}
