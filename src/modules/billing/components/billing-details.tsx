import { BuildingComplexIcon } from "@qeetrix/icons";
import { Button, Field, Radio, RadioGroup, Select, Skeleton, TextField } from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { ErrorReference } from "@/platform/components/error-reference";
import { errorMessage } from "@/platform/errors/user-message";
import { SensitiveActionCancelled } from "@/platform/security/sensitive-action-provider";

import type { BillingProfile } from "../api/billing";
import {
  BILLING_COUNTRIES,
  billingTaxIdValid,
  hasBillingProfile,
  normalizeBillingProfile,
} from "../billing-model";
import { Detail, Item, Panel, Section } from "./billing-parts";

export type BillingDetailsProps = {
  profile?: BillingProfile;
  /** Where the latest GST invoice's tax was supplied, for the tax ID's hint. */
  placeOfSupply?: string;
  canWrite: boolean;
  loading: boolean;
  error: boolean;
  onSave: (profile: BillingProfile) => Promise<BillingProfile>;
};

function useCountryName() {
  const { i18n } = useTranslation();
  return (code: string) => {
    try {
      return new Intl.DisplayNames([i18n.language], { type: "region" }).of(code) ?? code;
    } catch {
      return code;
    }
  };
}

/**
 * Who the invoices are made out to, as facts; Edit opens the whole record under the section's
 * head, since the details are one record on an invoice. The country, state and tax ID decide the
 * tax the server puts on each new invoice.
 */
export function BillingDetails(props: BillingDetailsProps) {
  const { t } = useTranslation("billing");
  const countryName = useCountryName();
  const [editing, setEditing] = useState(false);
  const profile = props.profile;
  const saved = hasBillingProfile(profile);
  const taxLabel = profile?.tax_id_type === "vat" ? "details.taxType.vat" : "details.taxType.gstin";

  return (
    <Section
      title={t("details.title")}
      description={t("details.description")}
      action={
        props.canWrite &&
        saved &&
        !editing && (
          <Button variant="ghost" onClick={() => setEditing(true)}>
            {t("details.edit")}
          </Button>
        )
      }
    >
      {props.loading ? (
        <Skeleton lines={3} />
      ) : props.error || !profile ? (
        <Alert tone="danger" title={t("details.loadFailed")} />
      ) : editing ? (
        <ul className="account-rows">
          <DetailsForm
            profile={profile}
            adding={!saved}
            onSave={props.onSave}
            onDone={() => setEditing(false)}
          />
        </ul>
      ) : saved ? (
        <dl className="account-details">
          <Detail label={t("details.legalName")}>{profile.legal_name || "—"}</Detail>
          <Detail label={t("details.email")}>{profile.billing_email || "—"}</Detail>
          <Detail label={t("details.address")}>
            <span className="bill-address">
              {[
                profile.address_line1,
                profile.address_line2,
                [profile.city, [profile.state, profile.postal_code].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(", "),
                profile.country ? countryName(profile.country) : "",
              ]
                .filter(Boolean)
                .map((line) => (
                  <span key={line}>{line}</span>
                ))}
            </span>
          </Detail>
          {profile.tax_id_type === "none" ? (
            <Detail label={t("details.taxId")}>{t("details.noTaxId")}</Detail>
          ) : (
            <Detail
              label={t(taxLabel)}
              hint={
                props.placeOfSupply
                  ? t("details.placeOfSupply", { place: props.placeOfSupply })
                  : undefined
              }
            >
              <span className="account-mono">{profile.tax_id}</span>
            </Detail>
          )}
        </dl>
      ) : (
        <ul className="account-rows">
          <Item
            icon={<BuildingComplexIcon />}
            name={t("details.emptyTitle")}
            line={t("details.emptyLine")}
            actions={
              props.canWrite && (
                <Button variant="ghost" onClick={() => setEditing(true)}>
                  {t("details.add")}
                </Button>
              )
            }
          />
        </ul>
      )}
    </Section>
  );
}

type TextKey =
  | "legal_name"
  | "billing_email"
  | "address_line1"
  | "address_line2"
  | "city"
  | "state";

const AUTOCOMPLETE: Record<TextKey, string> = {
  legal_name: "organization",
  billing_email: "email",
  address_line1: "address-line1",
  address_line2: "address-line2",
  city: "address-level2",
  state: "address-level1",
};

function DetailsForm({
  profile,
  adding,
  onSave,
  onDone,
}: {
  profile: BillingProfile;
  adding: boolean;
  onSave: (profile: BillingProfile) => Promise<BillingProfile>;
  onDone: () => void;
}) {
  const { t } = useTranslation("billing");
  const countryName = useCountryName();
  const [draft, setDraft] = useState(profile);
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const set =
    <Key extends keyof BillingProfile>(key: Key) =>
    (value: BillingProfile[Key]) =>
      setDraft((previous) => ({
        ...previous,
        [key]: value,
        ...(key === "tax_id_type" && value === "none" ? { tax_id: "" } : {}),
      }));
  const taxInvalid = checked && !billingTaxIdValid(draft);
  const countries = [
    ...new Set<string>([...BILLING_COUNTRIES, ...(draft.country ? [draft.country] : [])]),
  ];
  const india = draft.country === "IN" || !draft.country;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setChecked(true);
    setFailure(null);
    if (!billingTaxIdValid(draft)) return;
    setPending(true);
    try {
      await onSave(normalizeBillingProfile(draft));
      onDone();
    } catch (error) {
      if (!(error instanceof SensitiveActionCancelled)) setFailure(error);
    } finally {
      setPending(false);
    }
  }

  const text = (
    key: TextKey,
    label: string,
    extra: { description?: string; optional?: boolean; wide?: boolean; type?: string } = {},
  ) => (
    <TextField
      label={label}
      description={extra.description}
      optional={extra.optional}
      type={extra.type}
      value={draft[key]}
      onValueChange={set(key)}
      maxLength={key === "billing_email" ? 254 : 500}
      autoComplete={AUTOCOMPLETE[key]}
      disabled={pending}
      className={extra.wide ? "bill-wide" : undefined}
    />
  );

  return (
    <Panel
      as="li"
      title={t(adding ? "details.panelAdd" : "details.panelEdit")}
      description={t("details.panelDescription")}
    >
      <form id="billing-details" className="bill-form" noValidate onSubmit={submit}>
        {text("legal_name", t("details.legalName"), { wide: true })}
        {text("billing_email", t("details.email"), {
          wide: true,
          type: "email",
          description: t("details.emailHint"),
        })}
        {text("address_line1", t("details.line1"), { wide: true })}
        {text("address_line2", t("details.line2"), { wide: true, optional: true })}
        {text("city", t("details.city"))}
        {text("state", t("details.state"), {
          description: india ? t("details.stateHint") : undefined,
        })}
        <TextField
          label={t(india ? "details.postalIndia" : "details.postal")}
          value={draft.postal_code}
          onValueChange={set("postal_code")}
          autoComplete="postal-code"
          maxLength={500}
          disabled={pending}
        />
        <Field label={t("details.country")}>
          <Select
            items={countries.map((code) => ({ value: code, label: countryName(code) }))}
            value={draft.country || null}
            onValueChange={(code) => code && set("country")(String(code))}
            placeholder={t("details.countryPlaceholder")}
            disabled={pending}
          />
        </Field>
        <RadioGroup
          label={t("details.taxId")}
          orientation="horizontal"
          value={draft.tax_id_type}
          onValueChange={(value) => {
            set("tax_id_type")(value as BillingProfile["tax_id_type"]);
            setChecked(false);
          }}
          disabled={pending}
          className="bill-wide"
        >
          <Radio value="none" label={t("details.taxType.none")} />
          <Radio value="gstin" label={t("details.taxType.gstin")} />
          <Radio value="vat" label={t("details.taxType.vat")} />
        </RadioGroup>
        {draft.tax_id_type !== "none" && (
          <TextField
            label={t(
              draft.tax_id_type === "gstin" ? "details.taxType.gstin" : "details.taxType.vat",
            )}
            value={draft.tax_id}
            onValueChange={set("tax_id")}
            onBlur={() => setChecked(true)}
            maxLength={64}
            autoComplete="off"
            className="bill-mono"
            error={
              taxInvalid
                ? t(draft.tax_id_type === "gstin" ? "details.gstinError" : "details.vatError")
                : undefined
            }
            description={
              taxInvalid
                ? undefined
                : t(draft.tax_id_type === "gstin" ? "details.gstinHint" : "details.vatHint")
            }
            disabled={pending}
          />
        )}
        {failure ? (
          <Alert tone="danger" title={errorMessage(failure)} className="bill-wide">
            <ErrorReference error={failure} />
          </Alert>
        ) : null}
      </form>
      <span className="account-panel-actions">
        <Button type="submit" form="billing-details" loading={pending}>
          {t("details.save")}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          {t("details.cancel")}
        </Button>
      </span>
    </Panel>
  );
}
