import { RefreshCwIcon } from "@qeetrix/icons";
import { Button, Skeleton } from "@qeetrix/react";
import { Alert, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useEntitlements } from "@/modules/billing";
import { PageBreadcrumb } from "@/modules/dashboard";
import { orgQueries, useLoginDomain } from "@/modules/organizations";
import { useTenantId } from "@/platform/auth/session";
import { ErrorReference, ErrorText } from "@/platform/components/error-reference";
import { HOSTED_SIGN_IN_HOST } from "@/platform/config/site-urls";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

import { saveBranding, useBranding } from "../api/branding";
import { brandingKeys } from "../api/keys";
import {
  type Branding,
  type BrandingChange,
  brandingBackground,
  brandingReplyTo,
  brandingWith,
  normalizeBrandColor,
} from "../branding-model";
import { BrandingColours } from "./branding-colours";
import { BrandingLogo } from "./branding-logo";
import { BrandingPreview } from "./branding-preview";
import { BrandingAddress, BrandingSender } from "./branding-sender";
import "./branding.css";

// What an open editor holds, so the preview shows it before it's saved. "" is "back to the
// default"; undefined is "nothing being changed".
type Drafts = { logo?: string; brand?: string; background?: string; sender?: boolean };

/**
 * Settings › Branding: the sign-in page and emails as the organisation's people see them. Each
 * value (the logo, a colour, the sender) is changed where it sits and saved on its own; the
 * sign-in page beside them follows the value being changed. The server's PUT replaces the whole
 * record, so each save sends everything else back as stored.
 */
export function BrandingSettingsPage(props: { onDirtyChange?: (changed: boolean) => void }) {
  const tenantId = useTenantId();
  const access = useCapabilities();
  const writes = access.state === "ready" && access.can("branding.write");
  // Another organisation, or losing write access, starts the page afresh: nothing open or drafted.
  return <BrandingPage key={`${tenantId}:${writes}`} {...props} />;
}

function BrandingPage({ onDirtyChange }: { onDirtyChange?: (changed: boolean) => void }) {
  const { t } = useTranslation("branding");
  const tenantId = useTenantId();
  const access = useCapabilities();
  const canRead = !!tenantId && access.state === "ready" && access.can("tenant.read");
  const canReadDomains = canRead && access.can("connection.read");
  const canReadBilling = canRead && access.can("billing.read");
  const branding = useBranding(canRead);
  const loginDomain = useLoginDomain(canReadDomains);
  const entitlements = useEntitlements(canReadBilling);
  const orgName = useQuery({ ...orgQueries.list(), enabled: !!tenantId }).data?.items.find(
    (org) => org.id === tenantId,
  )?.name;
  // The server refuses a save on a plan without custom branding (402), so the page says so first.
  const entitled = !canReadBilling || entitlements.data?.features.custom_branding !== false;
  const canWrite = canRead && access.can("branding.write") && entitled;
  const sensitive = useSensitiveAction();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Drafts>({});
  const [failure, setFailure] = useState<unknown>(null);
  const active = useRef<{ tenantId: string | null; canWrite: boolean } | null>(null);
  const dirty = Object.values(drafts).some((value) => value !== undefined && value !== false);

  useEffect(() => {
    active.current = { tenantId, canWrite };
    return () => {
      active.current = null;
    };
  }, [tenantId, canWrite]);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const draft = (key: keyof Drafts) => (value: string | boolean | undefined) =>
    setDrafts((previous) => ({ ...previous, [key]: value }));

  /** Saves one change on top of the stored record; true once saved, false if it wasn't. */
  async function save(
    change: BrandingChange,
    confirm?: Parameters<typeof sensitive>[0]["confirm"],
  ): Promise<boolean> {
    const current = branding.data;
    if (!current || !tenantId) return false;
    setFailure(null);
    try {
      const result = await sensitive({
        capability: "branding.write",
        actionLabel: t("page.stepUp"),
        confirm,
        run: () => {
          if (active.current?.tenantId !== tenantId || !active.current.canWrite)
            throw new SensitiveActionCancelled();
          return saveBranding(tenantId, brandingWith({ ...current, tenant_id: tenantId }, change));
        },
      });
      if (!result) return false;
      queryClient.setQueryData(brandingKeys.tenant(tenantId), result);
      return true;
    } catch (error) {
      if (!(error instanceof SensitiveActionCancelled)) setFailure(error);
      return false;
    }
  }

  const removeLogo = () =>
    save(
      { logo_url: null },
      {
        title: t("logo.removeTitle"),
        description: t("logo.removeDescription"),
        confirmLabel: t("logo.removeConfirm"),
        tone: "destructive",
      },
    );

  const loading =
    access.state === "resolving" ||
    (canRead && (branding.isPending || (canReadBilling && entitlements.isPending)));

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("page.title")}
        description={
          orgName ? t("page.description", { name: orgName }) : t("page.descriptionNoName")
        }
      />
      <PageContent>
        {loading ? (
          <div role="status" aria-label={t("page.loading")}>
            <Skeleton lines={8} />
          </div>
        ) : !canRead || branding.isError || !branding.data ? (
          <Alert
            tone="danger"
            title={t("page.loadFailed")}
            actions={
              canRead && (
                <Button
                  variant="soft"
                  size="sm"
                  icon={RefreshCwIcon}
                  onClick={() => void branding.refetch()}
                >
                  {t("page.retry")}
                </Button>
              )
            }
          >
            {branding.error ? <ErrorReference error={branding.error} /> : null}
          </Alert>
        ) : (
          <BrandingLayout
            branding={branding.data}
            drafts={drafts}
            orgName={orgName}
            entitled={entitled}
            locked={!canWrite}
            canManageBilling={canReadBilling}
            canManageDomains={canReadDomains}
            loginDomain={canReadDomains && !loginDomain.isError ? loginDomain.data : undefined}
            failure={failure}
            onDraft={draft}
            onSave={save}
            onRemoveLogo={removeLogo}
          />
        )}
      </PageContent>
    </>
  );
}

function BrandingLayout({
  branding,
  drafts,
  orgName,
  entitled,
  locked,
  canManageBilling,
  canManageDomains,
  loginDomain,
  failure,
  onDraft,
  onSave,
  onRemoveLogo,
}: {
  branding: Branding;
  drafts: Drafts;
  orgName?: string;
  entitled: boolean;
  locked: boolean;
  canManageBilling: boolean;
  canManageDomains: boolean;
  loginDomain?: ReturnType<typeof useLoginDomain>["data"];
  failure: unknown;
  onDraft: (key: keyof Drafts) => (value: string | boolean | undefined) => void;
  onSave: (change: BrandingChange) => Promise<boolean>;
  onRemoveLogo: () => Promise<boolean>;
}) {
  const { t } = useTranslation("branding");
  const brand = normalizeBrandColor(branding.primary_color ?? "");
  const background = brandingBackground(branding);
  const customDomain = branding.custom_domain?.trim().toLowerCase() ?? "";
  const live =
    !!customDomain &&
    loginDomain?.login_domain.toLowerCase() === customDomain &&
    loginDomain.endpoint_state === "live";
  // A draft of "" is the default: no logo, Qeet Ember, the automatic background.
  const shown = (value: string | undefined, saved: string | null) =>
    value === undefined ? saved : value || null;

  return (
    <div className="brand-layout">
      <div className="brand-sections">
        {!entitled && (
          <Alert
            tone="info"
            title={t("page.free.title")}
            actions={
              canManageBilling && (
                <Button
                  variant="soft"
                  render={<Link to="/settings/billing" search={{ plan: "starter" }} />}
                >
                  {t("page.free.compare")}
                </Button>
              )
            }
          >
            {orgName ? t("page.free.body", { name: orgName }) : t("page.free.bodyNoName")}
          </Alert>
        )}
        {failure ? (
          <Alert tone="danger" title={t("page.saveFailed")} announce="urgent">
            <ErrorText error={failure} />
            <ErrorReference error={failure} />
          </Alert>
        ) : null}
        <BrandingLogo
          logo={branding.logo_url?.trim() || null}
          orgName={orgName}
          locked={locked}
          onDraft={onDraft("logo")}
          onSave={onSave}
          onRemove={onRemoveLogo}
        />
        <BrandingColours
          brand={brand}
          background={background}
          locked={locked}
          onDraft={(key, value) => onDraft(key)(value)}
          onSave={onSave}
        />
        <BrandingAddress
          customDomain={customDomain}
          loginDomain={loginDomain}
          canManageDomains={canManageDomains}
        />
        <BrandingSender
          values={{
            fromName: branding.email_from_name ?? "",
            replyTo: brandingReplyTo(branding),
            fromAddress: branding.email_from_address ?? "",
          }}
          orgName={orgName}
          locked={locked}
          onDirty={(changed) => onDraft("sender")(changed || undefined)}
          onSave={onSave}
        />
      </div>
      <aside className="brand-preview-col" aria-label={t("preview.title")}>
        <BrandingPreview
          values={{
            logo: shown(drafts.logo, branding.logo_url?.trim() || null),
            brand: shown(drafts.brand, brand),
            background: shown(drafts.background, background),
            host: live ? customDomain : HOSTED_SIGN_IN_HOST,
          }}
        />
      </aside>
    </div>
  );
}
