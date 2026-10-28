import { GlobeIcon } from "@qeetrix/icons";
import { Badge, Button, Text, TextField } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import type { LoginDomainStatus } from "@/modules/organizations";
import { HOSTED_SIGN_IN_HOST } from "@/platform/config/site-urls";

import { type BrandingChange, validBrandEmail } from "../branding-model";
import { Detail, Item, Panel, Section } from "./branding-parts";

/**
 * Where people sign in: Qeet's address, or the organisation's own once it's live. The address is
 * set up in Settings › Domains (DNS, then a certificate), so this row says what it is and links
 * there (redesign findings: the sign-in domain moves to Domains).
 */
export function BrandingAddress({
  customDomain,
  loginDomain,
  canManageDomains,
}: {
  customDomain: string;
  loginDomain?: LoginDomainStatus;
  canManageDomains: boolean;
}) {
  const { t } = useTranslation("branding");
  const live =
    !!customDomain &&
    loginDomain?.login_domain.toLowerCase() === customDomain.toLowerCase() &&
    loginDomain.endpoint_state === "live";
  return (
    <Section title={t("address.title")}>
      <ul className="account-rows">
        <Item
          icon={<GlobeIcon />}
          name={customDomain || HOSTED_SIGN_IN_HOST}
          badge={
            !customDomain ? (
              <Badge tone="neutral" size="sm">
                {t("address.qeet")}
              </Badge>
            ) : (
              <Badge tone={live ? "success" : "warning"} size="sm">
                {t(live ? "address.live" : "address.notLive")}
              </Badge>
            )
          }
          line={
            !customDomain
              ? t("address.qeetLine")
              : live
                ? t("address.ownLiveLine")
                : t("address.ownLine", { host: HOSTED_SIGN_IN_HOST })
          }
          actions={
            canManageDomains && (
              <Button variant="ghost" render={<Link to="/settings/organization/domains" />}>
                {t(customDomain ? "address.manage" : "address.useOwn")}
              </Button>
            )
          }
        />
      </ul>
    </Section>
  );
}

export type SenderValues = { fromName: string; replyTo: string; fromAddress: string };

/**
 * The sender on the organisation's email: its name and reply-to, which the server puts on every
 * email it sends for the organisation (on a plan with branding). The From address is saved but
 * never used: email still comes from Qeet's own address.
 */
export function BrandingSender({
  values,
  orgName,
  locked,
  onDirty,
  onSave,
}: {
  values: SenderValues;
  orgName?: string;
  locked: boolean;
  onDirty: (dirty: boolean) => void;
  onSave: (change: BrandingChange) => Promise<boolean>;
}) {
  const { t } = useTranslation("branding");
  const [editing, setEditing] = useState(false);
  const notSet = (
    <Text tone="subtle" size="md">
      {t("sender.notSet")}
    </Text>
  );
  return (
    <Section
      title={t("sender.title")}
      description={
        orgName ? t("sender.description", { name: orgName }) : t("sender.descriptionNoName")
      }
      action={
        !editing && (
          <Button variant="ghost" disabled={locked} onClick={() => setEditing(true)}>
            {t("sender.edit")}
          </Button>
        )
      }
    >
      {editing ? (
        <ul className="account-rows">
          <SenderForm
            values={values}
            onDirty={onDirty}
            onSave={onSave}
            onDone={() => {
              onDirty(false);
              setEditing(false);
            }}
          />
        </ul>
      ) : (
        <dl className="account-details">
          <Detail label={t("sender.fromName")}>{values.fromName || notSet}</Detail>
          <Detail label={t("sender.replyTo")}>{values.replyTo || notSet}</Detail>
          {values.fromAddress && (
            <Detail label={t("sender.fromAddress")} hint={t("sender.fromAddressHint")}>
              {values.fromAddress}
            </Detail>
          )}
        </dl>
      )}
    </Section>
  );
}

function SenderForm({
  values,
  onDirty,
  onSave,
  onDone,
}: {
  values: SenderValues;
  onDirty: (dirty: boolean) => void;
  onSave: (change: BrandingChange) => Promise<boolean>;
  onDone: () => void;
}) {
  const { t } = useTranslation("branding");
  const [draft, setDraft] = useState(values);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof SenderValues) => (value: string) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onDirty(
      (Object.keys(next) as (keyof SenderValues)[]).some(
        (field) => next[field].trim() !== values[field].trim(),
      ),
    );
  };
  const errors = {
    fromName: /[\r\n]/.test(draft.fromName) ? t("sender.nameInvalid") : undefined,
    replyTo: validBrandEmail(draft.replyTo) ? undefined : t("sender.emailInvalid"),
    fromAddress: validBrandEmail(draft.fromAddress) ? undefined : t("sender.emailInvalid"),
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setChecked(true);
    if (errors.fromName || errors.replyTo || errors.fromAddress) return;
    setSaving(true);
    const ok = await onSave({
      email_from_name: draft.fromName,
      email_reply_to: draft.replyTo,
      email_from_address: draft.fromAddress,
    });
    setSaving(false);
    if (ok) onDone();
  }

  return (
    <Panel as="li" title={t("sender.panelTitle")} description={t("sender.panelDescription")}>
      <form id="branding-sender" className="account-panel-form" noValidate onSubmit={submit}>
        <TextField
          label={t("sender.fromName")}
          description={errors.fromName && checked ? undefined : t("sender.fromNameHint")}
          error={checked ? errors.fromName : undefined}
          value={draft.fromName}
          onValueChange={set("fromName")}
          maxLength={128}
          autoComplete="organization"
          autoFocus
          disabled={saving}
        />
        <TextField
          label={t("sender.replyTo")}
          type="email"
          optional
          description={errors.replyTo && checked ? undefined : t("sender.replyToHint")}
          error={checked ? errors.replyTo : undefined}
          value={draft.replyTo}
          onValueChange={set("replyTo")}
          maxLength={254}
          autoComplete="email"
          disabled={saving}
        />
        <TextField
          label={t("sender.fromAddress")}
          type="email"
          optional
          description={errors.fromAddress && checked ? undefined : t("sender.fromAddressHint")}
          error={checked ? errors.fromAddress : undefined}
          value={draft.fromAddress}
          onValueChange={set("fromAddress")}
          maxLength={254}
          autoComplete="off"
          disabled={saving}
        />
      </form>
      <span className="account-panel-actions">
        <Button type="submit" form="branding-sender" loading={saving}>
          {t("sender.save")}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={saving}>
          {t("sender.cancel")}
        </Button>
      </span>
    </Panel>
  );
}
