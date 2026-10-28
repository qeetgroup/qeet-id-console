import { Avatar, Button, formatCurrency, formatDate, Heading, Link, Text } from "@qeetrix/react";
import { CopyButton, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { useSubscription } from "@/modules/billing";
import { PageBreadcrumb } from "@/modules/dashboard";
import { type Org, orgQueries, useUpdateOrg } from "@/modules/organizations/api/orgs";
import { useOrgLabels } from "@/modules/organizations/components/org-labels";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useSensitiveAction } from "@/platform/security/sensitive-action-provider";
import { LogoActions } from "./general-logo";
import {
  checkWebsite,
  metaText,
  PROFILE_KEYS,
  type ProfileKey,
  withProfile,
} from "./general-model";
import { Detail, LoadFailed, Loading, Section } from "./settings-parts";
import { TextFact } from "./text-fact";
import "./settings.css";

/**
 * Settings › General: the organisation first (its logo, name and plan), then the facts its people
 * see, each changed where it sits, then the facts fixed when it was created. No status: the server
 * always refuses suspending the organisation you're in, and deleting it lives on its page. Its data
 * region is read-only after creation.
 */
export function OrgGeneralPage() {
  const { t } = useTranslation("organizations");
  const tenantId = useTenantId();
  const orgQ = useQuery(orgQueries.record(tenantId));
  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("settings.general.title")}
        description={
          orgQ.data
            ? t("settings.general.description", { name: orgQ.data.name })
            : t("settings.general.descriptionNoName")
        }
      />
      <PageContent width="narrow">
        {orgQ.data ? (
          <GeneralSettings org={orgQ.data} />
        ) : orgQ.isError ? (
          <LoadFailed error={orgQ.error} onRetry={() => void orgQ.refetch()} />
        ) : (
          <Loading rows={4} />
        )}
      </PageContent>
    </>
  );
}

function GeneralSettings({ org }: { org: Org }) {
  const { t } = useTranslation("organizations");
  const access = useCapabilities();
  const canEdit = access.can("tenant.write");
  const names = useOrgLabels();
  const runSensitive = useSensitiveAction();
  const update = useUpdateOrg({ silentError: true });

  // PATCH /v1/tenants/{id} needs a recent second step; the Save that sent it is the confirmation.
  const save = (body: Parameters<typeof update.mutateAsync>[0]["body"]) =>
    runSensitive({
      capability: "tenant.write",
      actionLabel: t("settings.general.actionLabel"),
      run: () => update.mutateAsync({ id: org.id, body }),
    });

  const profileHint = {
    industry: t("settings.general.profile.industryHint"),
    headquarters: t("settings.general.profile.headquartersHint"),
    website: t("settings.general.profile.websiteHint"),
  } satisfies Record<ProfileKey, string>;
  const profilePlaceholder = {
    industry: t("settings.general.profile.industryPlaceholder"),
    headquarters: t("settings.general.profile.headquartersPlaceholder"),
    website: t("settings.general.profile.websitePlaceholder"),
  } satisfies Record<ProfileKey, string>;

  return (
    <>
      <div className="account-identity">
        <div className="account-identity-inner">
          <Avatar
            name={org.name}
            src={org.logo_url || undefined}
            shape="square"
            size="xl"
            decorative
          />
          <div className="account-identity-text">
            <Heading level={2} size="heading-md">
              {org.name}
            </Heading>
            <span className="account-identity-mail">
              {t("settings.general.planLine", { plan: names.plan(org.plan) })}
            </span>
            {canEdit && (
              <LogoActions hasLogo={!!org.logo_url} onSave={(logo_url) => save({ logo_url })} />
            )}
          </div>
        </div>
      </div>

      <Section
        title={t("settings.general.details.title")}
        description={t("settings.general.details.description", { name: org.name })}
      >
        <dl className="account-details">
          <TextFact
            label={t("settings.general.details.name")}
            value={org.name}
            shown={org.name}
            hint={t("settings.general.details.nameHint")}
            maxLength={200}
            canEdit={canEdit}
            editLabel={t("settings.edit")}
            check={(raw) =>
              raw.trim()
                ? { value: raw.trim() }
                : { error: t("settings.general.details.nameRequired") }
            }
            onSave={(name) => save({ name })}
          />
          {PROFILE_KEYS.map((key) => {
            const value = metaText(org.metadata, key);
            return (
              <TextFact
                key={key}
                label={t(`settings.general.profile.${key}`)}
                value={value}
                shown={
                  !value ? (
                    <Text tone="subtle">{t("settings.general.profile.notSet")}</Text>
                  ) : key === "website" ? (
                    <Link href={value} external>
                      {value.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </Link>
                  ) : (
                    value
                  )
                }
                hint={profileHint[key]}
                placeholder={profilePlaceholder[key]}
                maxLength={key === "website" ? 200 : 100}
                canEdit={canEdit}
                editLabel={value ? t("settings.edit") : t("settings.add")}
                check={(raw) => {
                  if (key !== "website") return { value: raw.trim() };
                  const website = checkWebsite(raw);
                  return website === null
                    ? { error: t("settings.general.profile.websiteInvalid") }
                    : { value: website };
                }}
                onSave={(next) => save({ metadata: withProfile(org.metadata, key, next) })}
              />
            );
          })}
        </dl>
      </Section>

      <AboutOrganisation org={org} />
    </>
  );
}

/** What was set when it was created, its plan, and its ID: facts, with where to change the plan. */
function AboutOrganisation({ org }: { org: Org }) {
  const { t } = useTranslation("organizations");
  const locale = formatLocale();
  const access = useCapabilities();
  const names = useOrgLabels();
  const canBill = access.can("billing.read");
  const sub = useSubscription(canBill && org.plan !== "free").data;
  const renews = sub && sub.amount_minor > 0 ? sub.current_period_end : null;
  return (
    <Section title={t("settings.general.about.title")}>
      <dl className="account-details">
        <Detail
          label={t("settings.general.about.slug")}
          hint={t("settings.general.about.slugHint", { name: org.name })}
        >
          <span className="account-mono">{org.slug}</span>
        </Detail>
        <Detail
          label={t("settings.general.about.region")}
          hint={t("settings.general.about.regionHint", { name: org.name })}
        >
          {org.region ? names.region(org.region) : "—"}
        </Detail>
        <Detail
          label={t("settings.general.about.plan")}
          hint={
            org.plan === "free"
              ? t("page.band.noCharge")
              : sub && renews
                ? t(sub.cancel_at_period_end ? "page.band.endsOn" : "page.band.price", {
                    amount: formatCurrency(sub.amount_minor / 100, sub.currency, locale, {
                      maximumFractionDigits: 0,
                    }),
                    interval: t(`page.band.per.${sub.interval === "year" ? "year" : "month"}`),
                    date: formatDate(renews, locale, { dateStyle: "medium" }),
                  })
                : undefined
          }
          action={
            canBill ? (
              <Button variant="ghost" render={<RouterLink to="/settings/billing" />}>
                {t("settings.general.about.manageBilling")}
              </Button>
            ) : undefined
          }
        >
          {names.plan(org.plan)}
        </Detail>
        <Detail label={t("settings.general.about.created")}>
          {formatDate(org.created_at, locale, { dateStyle: "long" })}
        </Detail>
        <Detail
          label={t("settings.general.about.id")}
          hint={t("settings.general.about.idHint")}
          action={
            <CopyButton value={org.id} label={t("settings.general.about.copyIdLabel")}>
              {t("settings.general.about.copyId")}
            </CopyButton>
          }
        >
          <span className="account-mono">{org.id}</span>
        </Detail>
      </dl>
    </Section>
  );
}
