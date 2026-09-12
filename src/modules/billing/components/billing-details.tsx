import {
  Button,
  cn,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@qeetrix/ui";
import {
  Building2Icon,
  CheckCircle2Icon,
  CreditCardIcon,
  Loader2Icon,
  LockKeyholeIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SaveIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "@/platform/errors/user-message";
import { SensitiveActionCancelled } from "@/platform/security/sensitive-action-provider";
import type { BillingProfile } from "../api/billing";
import { BILLING_COUNTRIES, billingTaxIdValid, normalizeBillingProfile } from "../billing-model";

const SURFACE =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 p-4 shadow-xs dark:bg-card/70 dark:shadow-none";
const INPUT =
  "h-8 min-w-0 rounded-md bg-muted/15 text-xs pointer-coarse:min-h-11 pointer-coarse:text-base";
const ACTION =
  "h-8 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";

export type BillingDetailsProps = {
  profile?: BillingProfile;
  canWrite: boolean;
  loading: boolean;
  error: boolean;
  fetching: boolean;
  onRetry: () => unknown;
  onSave: (profile: BillingProfile) => Promise<BillingProfile>;
};

function PaymentInformation() {
  const { t } = useTranslation("settings");
  return (
    <section aria-label={t("billing.screen.payment.title")} className={SURFACE}>
      <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
        <CreditCardIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        {t("billing.screen.payment.title")}
      </h2>
      <div className="mt-4 flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-md border border-dashed border-border bg-muted/30">
          <CreditCardIcon
            className="size-6 text-muted-foreground"
            strokeWidth={1.3}
            aria-hidden="true"
          />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium">{t("billing.screen.payment.managed")}</p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            {t("billing.screen.payment.unavailable")}
          </p>
        </div>
      </div>
      <p className="mt-4 flex items-start gap-1.5 border-t border-border/60 pt-3 text-[11px] leading-4 text-muted-foreground">
        <LockKeyholeIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        {t("billing.screen.payment.provider")}
      </p>
    </section>
  );
}

export function BillingDetails(props: BillingDetailsProps) {
  const { t } = useTranslation("settings");
  if (!props.loading && !props.error && props.profile)
    return <BillingProfileForm {...props} profile={props.profile} />;

  return (
    <div className="grid items-start gap-4 @min-[800px]/billing:grid-cols-[1.3fr_1fr]">
      <section aria-label={t("billing.screen.profile.title")} className={cn(SURFACE, "min-h-60")}>
        <h2 className="font-heading text-base font-semibold">
          {t("billing.screen.profile.title")}
        </h2>
        {props.loading ? (
          <div
            role="status"
            aria-label={t("billing.screen.profile.loading")}
            className="mt-5 space-y-4"
          >
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : (
          <div
            className="grid min-h-40 place-content-center justify-items-center gap-3 text-center"
            role="alert"
          >
            <p className="text-xs text-muted-foreground">{t("billing.screen.profile.error")}</p>
            <Button
              variant="outline"
              className={ACTION}
              disabled={props.fetching}
              onClick={() => void props.onRetry()}
            >
              <RefreshCwIcon aria-hidden="true" />
              {t("billing.screen.retry")}
            </Button>
          </div>
        )}
      </section>
      <PaymentInformation />
    </div>
  );
}

function BillingProfileForm({
  profile,
  canWrite,
  onSave,
}: BillingDetailsProps & { profile: BillingProfile }) {
  const { t, i18n } = useTranslation("settings");
  const id = useId();
  const [draft, setDraft] = useState(profile);
  const [changed, setChanged] = useState(false);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showTaxError, setShowTaxError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!dirty.current) setDraft(profile);
  }, [profile]);

  function update<Key extends keyof BillingProfile>(key: Key, value: BillingProfile[Key]) {
    if (busy.current || !canWrite) return;
    dirty.current = true;
    setChanged(true);
    setSaved(false);
    setError(null);
    setDraft((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "tax_id_type" && value === "none" ? { tax_id: "" } : {}),
    }));
  }

  function reset() {
    if (busy.current) return;
    dirty.current = false;
    setDraft(profile);
    setChanged(false);
    setSaved(false);
    setShowTaxError(false);
    setError(null);
  }

  async function save() {
    if (busy.current || !canWrite || !changed) return;
    setShowTaxError(true);
    if (!billingTaxIdValid(draft)) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await onSave(normalizeBillingProfile(draft));
      setDraft(result);
      dirty.current = false;
      setChanged(false);
      setSaved(true);
    } catch (failure) {
      if (!(failure instanceof SensitiveActionCancelled)) setError(errorMessage(failure));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function countryName(code: string) {
    try {
      return new Intl.DisplayNames([i18n.language], { type: "region" }).of(code) ?? code;
    } catch {
      return code;
    }
  }

  const countries = [
    ...new Set<string>([...BILLING_COUNTRIES, ...(draft.country ? [draft.country] : [])]),
  ];
  const taxError = showTaxError && !billingTaxIdValid(draft);
  const field = (key: keyof BillingProfile, type = "text", className?: string) => (
    <Field className={className}>
      <FieldLabel htmlFor={`${id}-${key}`}>{t(`billing.screen.profile.${key}`)}</FieldLabel>
      <Input
        id={`${id}-${key}`}
        type={type}
        value={draft[key]}
        onChange={(event) => update(key, event.target.value as BillingProfile[typeof key])}
        className={INPUT}
        maxLength={key === "billing_email" ? 254 : 500}
        autoComplete={
          key === "billing_email" ? "email" : key === "legal_name" ? "organization" : "off"
        }
      />
    </Field>
  );

  return (
    <form
      aria-label={t("billing.screen.profile.form")}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <fieldset
        disabled={!canWrite || pending}
        className="grid min-w-0 items-start gap-4 @min-[800px]/billing:grid-cols-[1.3fr_1fr] **:data-[slot=field]:gap-1.5 **:data-[slot=field-label]:text-[11px]"
      >
        <section aria-labelledby={`${id}-profile`} className={SURFACE}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2
              id={`${id}-profile`}
              className="flex items-center gap-2 font-heading text-base font-semibold"
            >
              <Building2Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              {t("billing.screen.profile.title")}
            </h2>
            {!canWrite && (
              <span className="text-[10px] text-muted-foreground">
                {t("billing.screen.readOnly")}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-x-3 gap-y-3 @min-[520px]/billing:grid-cols-2">
            {field("legal_name")}
            {field("billing_email", "email")}
            {field("address_line1")}
            {field("address_line2")}
            {field("city")}
            {field("state")}
            {field("postal_code")}
            <Field>
              <FieldLabel htmlFor={`${id}-country`}>{t("billing.country")}</FieldLabel>
              <Select
                value={draft.country || ""}
                onValueChange={(value) => value && update("country", value)}
              >
                <SelectTrigger id={`${id}-country`} className={INPUT}>
                  <SelectValue placeholder={t("billing.screen.profile.selectCountry")}>
                    {draft.country ? countryName(draft.country) : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {countries.map((code) => (
                    <SelectItem key={code} value={code}>
                      {countryName(code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {error && (
            <p className="mt-3 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
            <p
              role="status"
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              {saved && (
                <CheckCircle2Icon
                  className="size-3.5 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
              )}
              {t(
                saved
                  ? "billing.screen.profile.saved"
                  : changed
                    ? "billing.screen.profile.unsaved"
                    : "billing.screen.profile.invoiceDetails",
              )}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className={ACTION}
                disabled={!changed || pending || !canWrite}
                onClick={reset}
              >
                <RotateCcwIcon aria-hidden="true" />
                {t("billing.screen.profile.reset")}
              </Button>
              <Button type="submit" className={ACTION} disabled={!changed || pending || !canWrite}>
                {pending ? (
                  <Loader2Icon className="animate-spin" aria-hidden="true" />
                ) : (
                  <SaveIcon aria-hidden="true" />
                )}
                {t(pending ? "billing.screen.profile.saving" : "billing.screen.profile.save")}
              </Button>
            </div>
          </div>
        </section>
        <div className="min-w-0 space-y-4">
          <PaymentInformation />
          <section aria-labelledby={`${id}-tax`} className={SURFACE}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2
                id={`${id}-tax`}
                className="flex items-center gap-2 font-heading text-base font-semibold"
              >
                <ShieldCheckIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                {t("billing.screen.tax.title")}
              </h2>
              {profile.tax_id_type !== "none" && profile.tax_id && (
                <span className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                  {t("billing.screen.tax.provided")}
                </span>
              )}
            </div>
            <div className="grid gap-3 @min-[1050px]/billing:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${id}-tax-type`}>{t("billing.screen.tax.type")}</FieldLabel>
                <Select
                  value={draft.tax_id_type}
                  onValueChange={(value) => {
                    if (value === "none" || value === "gstin" || value === "vat") {
                      update("tax_id_type", value);
                      setShowTaxError(false);
                    }
                  }}
                >
                  <SelectTrigger id={`${id}-tax-type`} className={INPUT}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("billing.screen.tax.none")}</SelectItem>
                    <SelectItem value="gstin">{t("billing.screen.tax.gstin")}</SelectItem>
                    <SelectItem value="vat">{t("billing.screen.tax.vat")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {draft.tax_id_type !== "none" && (
                <Field data-invalid={taxError}>
                  <FieldLabel htmlFor={`${id}-tax-id`}>
                    {t(
                      draft.tax_id_type === "gstin"
                        ? "billing.screen.tax.gstinLabel"
                        : "billing.screen.tax.vatLabel",
                    )}
                  </FieldLabel>
                  <Input
                    id={`${id}-tax-id`}
                    value={draft.tax_id}
                    onChange={(event) => update("tax_id", event.target.value)}
                    onBlur={() => setShowTaxError(true)}
                    aria-invalid={taxError}
                    aria-describedby={taxError ? `${id}-tax-error` : undefined}
                    maxLength={64}
                    className={cn(INPUT, "font-mono")}
                  />
                  {taxError && (
                    <FieldError id={`${id}-tax-error`}>
                      {t(
                        draft.tax_id_type === "gstin"
                          ? "billing.screen.tax.invalidGstin"
                          : "billing.screen.tax.invalidVat",
                      )}
                    </FieldError>
                  )}
                </Field>
              )}
            </div>
            <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
              {t("billing.screen.tax.note")}
            </p>
          </section>
        </div>
      </fieldset>
    </form>
  );
}
