import { useTranslation } from "react-i18next";
import { Badge, Progress } from "@qeetrix/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  ChartColumnIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CreditCardIcon,
  MapPinIcon,
} from "@qeetrix/icons";

import { useTenantId } from "@/platform/auth/session";
import { PageHeader } from "@/platform/components/page-header";
import { filterNavigation, type NavItem, useNavGroups } from "@/platform/config/navigation";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useAuthPolicy } from "@/modules/authentication";
import { brandingQueries } from "@/modules/branding";
import { useSubscription } from "@/modules/billing";
import { orgQueries, useDomains, useEmailTemplates } from "@/modules/organizations";
import { useQeetAIProviderConfig } from "@/modules/qeetai";
import { REGIONS } from "@/shared/data/regions";

const OVERVIEW_URL = "/settings";

/** Status line rendered under a card's description. */
type CardStatus = {
  label?: string; // left-hand label
  done?: boolean; // puts a green check before the label
  meta?: string; // right-aligned supporting detail
  swatches?: string[]; // branding shows its palette instead of `meta`
};

function monthYear(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? undefined
    : d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function longDate(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? undefined
    : d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

// The greeting's key for the time of day.
function greetingKey(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

export function SettingsOverview() {
  const { t } = useTranslation("dashboard");
  const access = useCapabilities();
  const navGroups = useNavGroups();
  const tenantId = useTenantId();

  const orgsQ = useQuery(orgQueries.list()); // shared with the sidebar switcher, so a cache read
  const org = orgsQ.data?.items.find((o) => o.id === tenantId);

  const domainsQ = useDomains();
  const templatesQ = useEmailTemplates();
  const policyQ = useAuthPolicy();
  const subQ = useSubscription();
  const aiQ = useQeetAIProviderConfig();
  const brandingQ = useQuery(brandingQueries.detail(tenantId));

  const verifiedDomains = (domainsQ.data?.items ?? []).filter((d) => d.verified_at).length;
  const customTemplates = (templatesQ.data?.items ?? []).filter((t) => t.custom).length;
  const branding = brandingQ.data;
  const brandingDone = !!(branding?.primary_color || branding?.logo_url);
  const policy = policyQ.data;
  const securityDone = !!policy && policy.passkey_enabled;
  const sub = subQ.data;
  const aiConnected = aiQ.data?.source === "tenant" || !!aiQ.data?.provider;

  const regionKey = REGIONS.find((r) => r.value === org?.region)?.label;
  const regionLabel = regionKey ? t(regionKey) : (org?.region ?? undefined);
  const planLabel =
    sub?.plan_name ?? (org?.plan ? t("settingsOverview.plan", { plan: org.plan }) : undefined);

  // One entry per settings area, keyed by the nav URL so the cards stay in
  // lockstep with the sidebar and with each area's own page.
  const statusByUrl: Record<string, CardStatus> = {
    "/settings/organization/general": {
      meta: [
        org?.name,
        monthYear(org?.created_at) &&
          t("settingsOverview.established", { date: monthYear(org?.created_at) }),
      ]
        .filter(Boolean)
        .join(" · "),
    },
    "/settings/organization/domains": {
      done: verifiedDomains > 0,
      label:
        verifiedDomains > 0
          ? t("settingsOverview.verifiedDomains", { count: verifiedDomains })
          : t("settingsOverview.noVerifiedDomains"),
    },
    "/settings/branding": {
      done: brandingDone,
      label: t(brandingDone ? "settingsOverview.complete" : "settingsOverview.notConfigured"),
      swatches: [branding?.primary_color, branding?.secondary_color].filter(
        (c): c is string => !!c,
      ),
    },
    "/settings/organization/email-templates": {
      done: customTemplates > 0,
      label:
        customTemplates > 0
          ? t("settingsOverview.templatesConfigured", { count: customTemplates })
          : t("settingsOverview.defaultTemplates"),
    },
    "/settings/organization/security-policy": {
      done: securityDone,
      label: t(securityDone ? "settingsOverview.strong" : "settingsOverview.reviewRecommended"),
      meta: policy
        ? [
            t(
              policy.passkey_enabled
                ? "settingsOverview.passkeysOn"
                : "settingsOverview.passkeysOff",
            ),
            t(
              policy.remember_device_enabled
                ? "settingsOverview.mfaOptional"
                : "settingsOverview.mfaRequired",
            ),
          ].join(" · ")
        : undefined,
    },
    "/settings/billing": {
      done: !!sub,
      label: planLabel ?? t("settingsOverview.noSubscription"),
      meta:
        longDate(sub?.current_period_end) &&
        t("settingsOverview.renews", { date: longDate(sub?.current_period_end) }),
    },
    "/settings/qeet-ai": {
      done: aiConnected,
      label: t(aiConnected ? "settingsOverview.connected" : "settingsOverview.notConnected"),
      meta: aiQ.data?.provider
        ? [aiQ.data.provider, aiQ.data.model && t("settingsOverview.oneModel")]
            .filter(Boolean)
            .join(" · ")
        : undefined,
    },
  };

  const visibleGroup = filterNavigation(navGroups, access.can).find((g) => g.id === "settings");
  const items = (visibleGroup?.items ?? []).filter((item) => item.url !== OVERVIEW_URL);

  // Progress counts only the areas this operator can actually see, so the
  // denominator always matches the cards below it.
  const completable = items.filter((i) => statusByUrl[i.url]?.done !== undefined);
  const complete = completable.filter((i) => statusByUrl[i.url]?.done).length;
  const total = completable.length;
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader description={t("settingsOverview.description")} />
        {total > 0 ? (
          <div className="flex min-w-0 shrink-0 flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center xl:w-[34rem]">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-medium">{t("settingsOverview.organizationSetup")}</p>
              <Progress value={pct} className="h-1.5" />
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("settingsOverview.progress", { complete, total })}
              </p>
            </div>
            <div className="flex items-center gap-3 border-t pt-3 sm:border-s sm:border-t-0 sm:ps-4 sm:pt-0">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("settingsOverview.finishSetup")}</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("settingsOverview.completeYourConfigurationFor")}
                </p>
              </div>
              <Link
                to={
                  (items.find((i) => statusByUrl[i.url]?.done === false)?.url ??
                    items[0]?.url) as never
                }
                aria-label={t("settingsOverview.goToTheNext")}
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <ChartColumnIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-base font-semibold">
              {org?.name
                ? t(`settingsOverview.greeting.${greetingKey()}Named`, { name: org.name })
                : t(`settingsOverview.greeting.${greetingKey()}`)}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("settingsOverview.yourOrganizationIsActive")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPillChip icon={<span className="size-2 rounded-full bg-emerald-500" />}>
            {t("settingsOverview.operational")}
          </StatusPillChip>
          {planLabel ? (
            <StatusPillChip icon={<CreditCardIcon className="size-3.5" />}>
              {planLabel}
            </StatusPillChip>
          ) : null}
          {regionLabel ? (
            <StatusPillChip icon={<MapPinIcon className="size-3.5" />}>
              {regionLabel}
            </StatusPillChip>
          ) : null}
          <span className="hidden h-6 w-px bg-border sm:block" />
          <Badge variant="muted" className="shrink-0 tabular-nums">
            {t("settingsOverview.areas", { count: items.length })}
          </Badge>
        </div>
      </section>

      <nav aria-label={t("settingsOverview.settingsAreas")} className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <SettingsCard key={item.url} item={item} status={statusByUrl[item.url]} />
        ))}
      </nav>
    </div>
  );
}

function StatusPillChip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {icon}
      {children}
    </span>
  );
}

function SettingsCard({ item, status }: { item: NavItem; status?: CardStatus }) {
  const hasFooter = !!(status?.label || status?.meta || status?.swatches?.length);

  return (
    <Link
      to={item.url as never}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground ring-1 ring-foreground/5 transition-colors group-hover:text-foreground [&_svg]:size-4.5">
          {item.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold">{item.title}</p>
          {item.description ? (
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.description}</p>
          ) : null}
        </div>
        <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      {hasFooter ? (
        <div className="flex items-center justify-between gap-3 ps-13">
          <span className="flex min-w-0 items-center gap-1.5 text-sm">
            {status?.done ? (
              <CircleCheckIcon className="size-4 shrink-0 text-emerald-500" />
            ) : status?.done === false ? (
              <span className="size-2 shrink-0 rounded-full bg-muted-foreground/40" />
            ) : null}
            <span className="truncate text-muted-foreground">{status?.label}</span>
          </span>
          {status?.swatches?.length ? (
            <span className="flex shrink-0 items-center gap-1.5">
              {status.swatches.map((c) => (
                <span
                  key={c}
                  className="size-4 rounded-full ring-1 ring-foreground/10"
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
          ) : status?.meta ? (
            <span className="shrink-0 truncate text-xs text-muted-foreground">{status.meta}</span>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}
