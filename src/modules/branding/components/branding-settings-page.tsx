import {
  Button,
  buttonVariants,
  cn,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Skeleton,
  StatusPill,
} from "@qeetrix/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRightIcon,
  CheckCircle2Icon,
  FileTextIcon,
  ImageIcon,
  InfoIcon,
  LinkIcon,
  Loader2Icon,
  MailIcon,
  PaletteIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SaveIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useEntitlements } from "@/modules/billing";
import {
  type LoginDomainStatus,
  type TenantDomain,
  useDomains,
  useLoginDomain,
} from "@/modules/organizations";
import { useTenantId } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { LogoField, type LogoStatus } from "@/shared/components/logo-field";
import { BRANDING_KEY, saveBranding, useBranding } from "../api/branding";
import {
  BRANDING_COLORS,
  type Branding,
  type BrandingDraft,
  brandingContrast,
  brandingDraft,
  brandingForeground,
  brandingInput,
  normalizeBrandColor,
  validateBranding,
} from "../branding-model";
import { BrandingPreview } from "./branding-preview";

const PANEL =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 p-3.5 shadow-xs dark:bg-card/70 dark:shadow-none";
const INPUT =
  "h-8 min-w-0 rounded-md bg-muted/15 text-xs pointer-coarse:min-h-11 pointer-coarse:text-base";
const ACTION =
  "h-8 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";
const ACCENTS = ["#f97316", "#ef4444", "#d946ef", "#8b5cf6", "#3b82f6", "#06b6d4", "#10b981"];
const BACKGROUNDS = ["#ffffff", "#f4f4f5", "#e4e4e7", "#a1a1aa", "#52525b", "#27272a", "#09090b"];

export type BrandingSettingsViewProps = {
  branding?: Branding;
  domains?: TenantDomain[];
  loginDomain?: LoginDomainStatus;
  domainsState: "ready" | "loading" | "error" | "denied";
  loading: boolean;
  error: boolean;
  fetching: boolean;
  canRead: boolean;
  canWrite: boolean;
  canManageDomains: boolean;
  canManageBilling: boolean;
  entitled: boolean;
  onRetry: () => unknown;
  onSave: (branding: Branding) => Promise<Branding>;
  onDirtyChange?: (changed: boolean) => void;
};

export function BrandingSettingsPage({
  onDirtyChange,
}: Pick<BrandingSettingsViewProps, "onDirtyChange">) {
  const { t } = useTranslation("settings");
  const tenantId = useTenantId();
  const access = useCapabilities();
  const canRead = !!tenantId && access.state === "ready" && access.can("tenant.read");
  const canReadDomains = canRead && access.can("connection.read");
  const canReadBilling = canRead && access.can("billing.read");
  const branding = useBranding(canRead);
  const domains = useDomains(canReadDomains);
  const loginDomain = useLoginDomain(canReadDomains);
  const entitlements = useEntitlements(canReadBilling);
  const entitled = !canReadBilling || entitlements.data?.features.custom_branding !== false;
  const canWrite = canRead && access.can("branding.write") && entitled;
  const sensitive = useSensitiveAction();
  const queryClient = useQueryClient();
  const active = useRef<{ tenantId: string | null; canWrite: boolean } | null>(null);
  useEffect(() => {
    active.current = { tenantId, canWrite };
    return () => {
      active.current = null;
    };
  }, [tenantId, canWrite]);

  return (
    <BrandingSettingsView
      key={`${tenantId}:${canWrite}`}
      onDirtyChange={onDirtyChange}
      branding={canRead && !branding.isError ? branding.data : undefined}
      domains={canReadDomains && !domains.isError ? domains.data?.items : undefined}
      loginDomain={canReadDomains && !loginDomain.isError ? loginDomain.data : undefined}
      domainsState={
        !canReadDomains
          ? "denied"
          : domains.isPending
            ? "loading"
            : domains.isError
              ? "error"
              : "ready"
      }
      loading={
        access.state === "resolving" ||
        (canRead && (branding.isPending || (canReadBilling && entitlements.isPending)))
      }
      error={branding.isError}
      fetching={branding.isFetching}
      canRead={canRead}
      canWrite={canWrite}
      canManageDomains={canReadDomains}
      canManageBilling={canReadBilling}
      entitled={entitled}
      onRetry={branding.refetch}
      onSave={async (input) => {
        const result = await sensitive({
          capability: "branding.write",
          actionLabel: t("branding.footer.save"),
          run: () => {
            if (!tenantId || active.current?.tenantId !== tenantId || !active.current.canWrite)
              throw new SensitiveActionCancelled();
            return saveBranding(tenantId, { ...input, tenant_id: tenantId });
          },
        });
        if (!result) throw new SensitiveActionCancelled();
        queryClient.setQueryData([...BRANDING_KEY, tenantId], result);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: [...BRANDING_KEY, tenantId] }),
          queryClient.invalidateQueries({ queryKey: ["domains", "login", tenantId] }),
        ]);
        return result;
      }}
    />
  );
}

export function BrandingSettingsView(props: BrandingSettingsViewProps) {
  const { t } = useTranslation("settings");
  return (
    <div className="@container/branding relative isolate flex min-w-0 flex-col gap-4 before:pointer-events-none before:absolute before:-inset-4 before:-z-10 before:bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] before:bg-size-[32px_32px] before:opacity-10 dark:before:opacity-5">
      <header className="flex flex-wrap items-center justify-between gap-4 py-1">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
            <PaletteIcon className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-[30px] font-semibold leading-9">
              {t("branding.workspace.title")}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
              {t("branding.description")}
            </p>
          </div>
        </div>
        <a
          href="https://docs.id.qeet.in/docs"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline" }), ACTION, "bg-card/80")}
        >
          <FileTextIcon aria-hidden="true" />
          {t("branding.workspace.docs")}
        </a>
      </header>
      {props.loading ? (
        <div
          role="status"
          aria-label={t("branding.workspace.loading")}
          className="grid gap-4 @min-[880px]/branding:grid-cols-[1.75fr_1fr]"
        >
          <div className="space-y-4">
            {["identity", "colors", "domain"].map((section) => (
              <Skeleton key={section} className="h-44 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-lg" />
        </div>
      ) : !props.canRead || props.error || !props.branding ? (
        <section
          className={cn(
            PANEL,
            "grid min-h-80 place-content-center justify-items-center gap-3 p-6 text-center",
          )}
        >
          <ShieldCheckIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-heading text-base font-semibold">
            {t(props.canRead ? "branding.workspace.loadError" : "branding.workspace.noAccess")}
          </h2>
          {props.canRead && (
            <Button
              variant="outline"
              className={ACTION}
              disabled={props.fetching}
              onClick={() => void props.onRetry()}
            >
              <RefreshCwIcon aria-hidden="true" />
              {t("branding.workspace.retry")}
            </Button>
          )}
        </section>
      ) : (
        <BrandingForm {...props} branding={props.branding} />
      )}
    </div>
  );
}

function BrandingForm({ branding, ...props }: BrandingSettingsViewProps & { branding: Branding }) {
  const { t } = useTranslation("settings");
  const id = useId();
  const [savedBranding, setSavedBranding] = useState(branding);
  const [draft, setDraft] = useState(() => brandingDraft(branding));
  const [touched, setTouched] = useState<Partial<Record<keyof BrandingDraft, boolean>>>({});
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoStatus, setLogoStatus] = useState<LogoStatus>("empty");
  const dirty = useRef(false);
  const busy = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const baseline = brandingDraft(savedBranding);
  const changed = Object.entries(draft).some(
    ([key, value]) => value !== baseline[key as keyof BrandingDraft],
  );
  const errors = validateBranding(draft);
  const valid = Object.keys(errors).length === 0;
  const primary = normalizeBrandColor(draft.primary_color) ?? BRANDING_COLORS.primary;
  const secondary = normalizeBrandColor(draft.secondary_color) ?? BRANDING_COLORS.secondary;
  const buttonContrast = brandingContrast(primary, brandingForeground(primary));
  const linkContrast = brandingContrast(primary, "#ffffff");
  const savedDomain = savedBranding.custom_domain?.trim().toLowerCase() ?? "";
  const domainChanged = draft.custom_domain.trim().toLowerCase() !== savedDomain;
  const hostStatus =
    !domainChanged && props.loginDomain?.login_domain.toLowerCase() === savedDomain
      ? props.loginDomain
      : undefined;
  const verifiedDomain = props.domains?.find(
    (domain) =>
      domain.domain.toLowerCase() === savedDomain &&
      !!domain.verified_at &&
      Number.isFinite(Date.parse(domain.verified_at)),
  );

  useEffect(() => {
    setSavedBranding(branding);
    if (!dirty.current) setDraft(brandingDraft(branding));
  }, [branding]);
  useEffect(() => {
    props.onDirtyChange?.(changed);
    return () => props.onDirtyChange?.(false);
  }, [changed, props.onDirtyChange]);
  useEffect(() => {
    if (!changed) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);

  function update<Key extends keyof BrandingDraft>(key: Key, value: BrandingDraft[Key]) {
    if (!props.canWrite || busy.current) return;
    setDraft((previous) => {
      const next = { ...previous, [key]: value };
      dirty.current = Object.entries(next).some(
        ([field, nextValue]) => nextValue !== baseline[field as keyof BrandingDraft],
      );
      return next;
    });
    setSaved(false);
    setError(null);
  }

  function reset() {
    if (busy.current) return;
    dirty.current = false;
    setDraft(brandingDraft(savedBranding));
    setTouched({});
    setSaved(false);
    setError(null);
  }

  async function save() {
    if (!props.canWrite || busy.current || !changed) return;
    setTouched(Object.fromEntries(Object.keys(draft).map((key) => [key, true])));
    if (!valid || logoStatus === "error" || logoStatus === "loading") {
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await props.onSave(brandingInput(draft, savedBranding));
      dirty.current = false;
      setSavedBranding(result);
      setDraft(brandingDraft(result));
      setSaved(true);
    } catch (failure) {
      if (!(failure instanceof SensitiveActionCancelled)) setError(errorMessage(failure));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  const fieldError = (key: keyof BrandingDraft) =>
    touched[key] && errors[key] ? (
      <FieldError id={`${id}-${key}-error`}>
        {t(`branding.workspace.validation.${errors[key]}`)}
      </FieldError>
    ) : null;
  const textField = (
    key: "custom_domain" | "email_from_name" | "email_from_address" | "email_reply_to",
    placeholder?: string,
  ) => (
    <Field>
      <FieldLabel htmlFor={`${id}-${key}`}>{t(`branding.workspace.fields.${key}`)}</FieldLabel>
      <Input
        id={`${id}-${key}`}
        name={key}
        type={key === "email_from_address" || key === "email_reply_to" ? "email" : "text"}
        value={draft[key]}
        onChange={(event) => update(key, event.target.value)}
        onBlur={() => setTouched((previous) => ({ ...previous, [key]: true }))}
        aria-invalid={!!(touched[key] && errors[key])}
        aria-describedby={touched[key] && errors[key] ? `${id}-${key}-error` : undefined}
        placeholder={placeholder}
        className={INPUT}
        maxLength={key === "email_from_name" ? 128 : 254}
      />
      {fieldError(key)}
    </Field>
  );

  return (
    <>
      {!props.entitled && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
          <p className="text-xs text-warning">{t("branding.workspace.upgrade")}</p>
          {props.canManageBilling && (
            <Link
              to="/settings/billing"
              search={{ plan: "starter" }}
              className={cn(buttonVariants({ variant: "outline" }), ACTION)}
            >
              {t("branding.workspace.comparePlans")}
              <ArrowUpRightIcon />
            </Link>
          )}
        </div>
      )}
      <form
        ref={form}
        aria-label={t("branding.workspace.form")}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="min-w-0"
      >
        <div className="grid min-w-0 items-start gap-4 @min-[880px]/branding:grid-cols-[minmax(0,1.8fr)_minmax(18rem,1fr)]">
          <fieldset
            disabled={!props.canWrite || pending}
            className="min-w-0 space-y-4 **:data-[slot=field]:gap-1.5 **:data-[slot=field-label]:text-[11px]"
          >
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
                value={draft.logo_url}
                onChange={(value) => update("logo_url", value)}
                onStatusChange={setLogoStatus}
                disabled={!props.canWrite || pending}
                layout="split"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                maxSizeMB={2}
                hint={t("branding.workspace.identity.hint")}
              />
              {errors.logo_url && (
                <p role="alert" className="mt-2 text-xs text-destructive">
                  {t("branding.workspace.validation.logo")}
                </p>
              )}
            </section>
            <section className={PANEL} aria-labelledby={`${id}-colors`}>
              <h2
                id={`${id}-colors`}
                className="flex items-center gap-2 font-heading text-sm font-semibold"
              >
                <PaletteIcon className="size-4 text-info" aria-hidden="true" />
                {t("branding.workspace.colors.title")}
              </h2>
              <p className="mb-3 mt-1 text-[11px] leading-4 text-muted-foreground">
                {t("branding.workspace.colors.description")}
              </p>
              <div className="grid grid-cols-1 gap-4 @min-[650px]/branding:grid-cols-3">
                {(["primary_color", "secondary_color", "background_color"] as const).map((key) => {
                  const color =
                    normalizeBrandColor(draft[key]) ??
                    (key === "background_color"
                      ? "#ffffff"
                      : BRANDING_COLORS[key === "primary_color" ? "primary" : "secondary"]);
                  const label = t(`branding.workspace.fields.${key}`);
                  return (
                    <Field key={key}>
                      <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
                      <p className="min-h-4 text-[10px] leading-4 text-muted-foreground">
                        {t(`branding.workspace.colors.${key}`)}
                      </p>
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="relative size-7 shrink-0 overflow-hidden rounded-full border border-border/70"
                          style={{ backgroundColor: color }}
                        >
                          <input
                            type="color"
                            value={color}
                            aria-label={t("branding.workspace.colors.pick", { color: label })}
                            onChange={(event) => update(key, event.target.value)}
                            className="absolute inset-0 size-full cursor-pointer opacity-0"
                          />
                        </span>
                        <Input
                          id={`${id}-${key}`}
                          value={draft[key]}
                          placeholder={
                            key === "background_color"
                              ? t("branding.workspace.colors.automatic")
                              : color
                          }
                          onChange={(event) => update(key, event.target.value)}
                          onBlur={() => setTouched((previous) => ({ ...previous, [key]: true }))}
                          aria-invalid={!!(touched[key] && errors[key])}
                          aria-describedby={
                            touched[key] && errors[key] ? `${id}-${key}-error` : undefined
                          }
                          className={cn(INPUT, "font-mono text-[11px]")}
                          maxLength={7}
                        />
                      </div>
                      <div className="mt-1 flex min-h-5 flex-wrap items-center gap-1.5">
                        {(key === "background_color" ? BACKGROUNDS : ACCENTS).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            aria-label={t("branding.workspace.colors.swatch", {
                              color: label,
                              hex: preset,
                            })}
                            aria-pressed={normalizeBrandColor(draft[key]) === preset}
                            onClick={() => update(key, preset)}
                            className={cn(
                              "relative size-4 cursor-pointer rounded border border-border/50 outline-offset-2 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring pointer-coarse:size-8",
                              normalizeBrandColor(draft[key]) === preset &&
                                "ring-1 ring-foreground ring-offset-2 ring-offset-card",
                            )}
                            style={{ backgroundColor: preset }}
                          />
                        ))}
                        {key === "background_color" && (
                          <button
                            type="button"
                            title={t("branding.workspace.colors.resetBackground")}
                            aria-label={t("branding.workspace.colors.resetBackground")}
                            onClick={() => update(key, "")}
                            className="grid size-5 cursor-pointer place-items-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:size-8"
                          >
                            <RotateCcwIcon className="size-3" />
                          </button>
                        )}
                      </div>
                      {fieldError(key)}
                    </Field>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/50 bg-muted/20 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <PaletteIcon className="mt-0.5 size-3.5 shrink-0 text-info" aria-hidden="true" />
                  <div>
                    <p className="text-[11px] font-medium">
                      {t("branding.workspace.colors.preview")}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {t("branding.workspace.colors.contrast", {
                        ratio: buttonContrast.toFixed(1),
                      })}
                    </p>
                  </div>
                </div>
                <div aria-hidden="true" className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded px-3 py-1.5 text-[10px] font-medium"
                    style={{ backgroundColor: primary, color: brandingForeground(primary) }}
                  >
                    {t("branding.workspace.colors.primaryButton")}
                  </span>
                  <span
                    className="rounded px-3 py-1.5 text-[10px] font-medium"
                    style={{ backgroundColor: secondary, color: brandingForeground(secondary) }}
                  >
                    {t("branding.workspace.colors.secondaryButton")}
                  </span>
                </div>
              </div>
              {linkContrast < 4.5 && (
                <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-warning">
                  <InfoIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                  {t("branding.workspace.colors.linkWarning", { ratio: linkContrast.toFixed(1) })}
                </p>
              )}
            </section>
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
                  {textField("custom_domain", "auth.example.com")}
                  <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">
                    {t("branding.workspace.domain.setup")}
                  </p>
                </div>
                <div className="flex flex-col items-start justify-between gap-2 @min-[720px]/branding:border-s @min-[720px]/branding:border-border/60 @min-[720px]/branding:ps-3">
                  <StatusPill
                    kind={
                      domainChanged
                        ? "warning"
                        : !savedDomain || props.domainsState !== "ready"
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
                          : props.domainsState !== "ready"
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
                  {props.canManageDomains && (
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
            <section className={PANEL} aria-labelledby={`${id}-email`}>
              <h2
                id={`${id}-email`}
                className="flex items-center gap-2 font-heading text-sm font-semibold"
              >
                <MailIcon className="size-4 text-info" aria-hidden="true" />
                {t("branding.workspace.email.title")}
              </h2>
              <p className="mb-3 mt-1 text-[11px] leading-4 text-muted-foreground">
                {t("branding.workspace.email.description")}
              </p>
              <div className="grid gap-3 @min-[720px]/branding:grid-cols-3">
                {textField("email_from_name", "Example Auth")}
                {textField("email_from_address", "noreply@example.com")}
                {textField("email_reply_to", "support@example.com")}
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-4 text-muted-foreground">
                <InfoIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                {t("branding.workspace.email.providerNote")}
              </p>
            </section>
          </fieldset>
          <BrandingPreview draft={draft} logoReady={logoStatus === "ready"} />
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive"
          >
            {error}
          </p>
        )}
        <footer className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/95 px-4 py-3 shadow-sm backdrop-blur-md">
          <p role="status" className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                changed ? "bg-primary" : saved ? "bg-success" : "bg-muted-foreground/60",
              )}
              aria-hidden="true"
            />
            {t(
              !props.canWrite
                ? "branding.workspace.readOnly"
                : changed
                  ? "branding.workspace.unsaved"
                  : saved
                    ? "branding.workspace.saved"
                    : "branding.workspace.upToDate",
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className={ACTION}
              onClick={reset}
              disabled={pending || !changed || !props.canWrite}
            >
              <RotateCcwIcon aria-hidden="true" />
              {t("branding.workspace.reset")}
            </Button>
            <Button
              type="submit"
              className={ACTION}
              disabled={
                !props.canWrite ||
                pending ||
                !changed ||
                !valid ||
                logoStatus === "loading" ||
                logoStatus === "error"
              }
            >
              {pending ? (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              ) : saved && !changed ? (
                <CheckCircle2Icon aria-hidden="true" />
              ) : (
                <SaveIcon aria-hidden="true" />
              )}
              {t(pending ? "branding.footer.saving" : "branding.footer.save")}
            </Button>
          </div>
        </footer>
      </form>
    </>
  );
}
