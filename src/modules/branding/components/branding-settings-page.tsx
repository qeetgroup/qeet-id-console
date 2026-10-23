import { Button, buttonVariants, cn, Skeleton } from "@qeetrix/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRightIcon,
  CircleCheckIcon,
  FileTextIcon,
  LoaderCircleIcon,
  PaletteIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SaveIcon,
  ShieldCheckIcon,
} from "@qeetrix/icons";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useEntitlements } from "@/modules/billing";
import {
  type LoginDomainStatus,
  orgKeys,
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
import type { LogoStatus } from "@/shared/components/logo-field";
import { saveBranding, useBranding } from "../api/branding";
import { brandingKeys } from "../api/keys";
import {
  type Branding,
  type BrandingDraft,
  brandingDraft,
  brandingInput,
  validateBranding,
} from "../branding-model";
import { BrandingPreview } from "./branding-preview";
import { BrandingColorsSection } from "./branding-settings-page-colors";
import {
  BrandingDomainSection,
  BrandingEmailSection,
  type BrandingFields,
  BrandingIdentitySection,
} from "./branding-settings-page-sections";

const PANEL =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 p-3.5 shadow-xs dark:bg-card/70 dark:shadow-none";
const ACTION =
  "h-8 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";

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
  const { t } = useTranslation("branding");
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
        queryClient.setQueryData(brandingKeys.tenant(tenantId), result);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: brandingKeys.tenant(tenantId) }),
          queryClient.invalidateQueries({ queryKey: orgKeys.loginDomain(tenantId) }),
        ]);
        return result;
      }}
    />
  );
}

export function BrandingSettingsView(props: BrandingSettingsViewProps) {
  const { t } = useTranslation("branding");
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
  const { t } = useTranslation("branding");
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

  const fields: BrandingFields = {
    id,
    draft,
    touched,
    errors,
    onChange: update,
    onTouch: (key) => setTouched((previous) => ({ ...previous, [key]: true })),
  };

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
            <BrandingIdentitySection
              id={id}
              logo={draft.logo_url}
              invalid={!!errors.logo_url}
              disabled={!props.canWrite || pending}
              onChange={(value) => update("logo_url", value)}
              onStatusChange={setLogoStatus}
            />
            <BrandingColorsSection fields={fields} />
            <BrandingDomainSection
              fields={fields}
              saved={savedBranding}
              domains={props.domains}
              loginDomain={props.loginDomain}
              domainsState={props.domainsState}
              canManageDomains={props.canManageDomains}
            />
            <BrandingEmailSection fields={fields} />
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
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
              ) : saved && !changed ? (
                <CircleCheckIcon aria-hidden="true" />
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
