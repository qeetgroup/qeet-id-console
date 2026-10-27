// The Dashboard (/): the first page every administrator sees. Four measures across the top; sign-ins
// over 14 days beside what needs attention; then sign-in and security, people and apps, and the
// organisation's set-up as a checklist. Each panel reads only what the person may: a panel whose
// data they can't read isn't shown, and a set-up item whose source they can't read drops out.
// Nothing here writes: loading the Dashboard never changes the organisation.

import { UserPlusIcon } from "@qeetrix/icons";
import { Button } from "@qeetrix/react";
import { Alert, DataState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  authPolicyQueries,
  oidcClientQueries,
  useLdapConnections,
  useOAuthGrants,
  useSamlConnections,
  useSamlProviders,
  useScimConfig,
  useSocialProviders,
  useTrustedDeviceSummary,
} from "@/modules/authentication";
import { useSubscription } from "@/modules/billing";
import { apiKeyQueries, webhookQueries } from "@/modules/developer";
import { useDomains } from "@/modules/organizations";
import { useAnomalies } from "@/modules/security";
import { invitationQueries, useUserStats } from "@/modules/users";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useAnalyticsOverview } from "@/modules/dashboard/api/analytics";
import { loginMethodLabel } from "@/modules/dashboard/dashboard-model";
import { appsInUse, deriveOverviewAttention } from "@/modules/dashboard/overview-model";
import { deriveSetup } from "@/modules/dashboard/overview-setup-model";
import { RecentActivityPanel } from "./overview-activity";
import { NeedsAttentionPanel } from "./overview-attention";
import { Group } from "./overview-parts";
import { ActivePeoplePanel, AppsPanel } from "./overview-people";
import { PulseBand } from "./overview-pulse";
import { FailedHoursPanel, TwoStepPanel } from "./overview-security";
import { SignInMethodsPanel, SignInsPanel } from "./overview-sign-ins";
import { SetupPanel } from "./overview-setup";

const columns = (n: number) => `repeat(${n}, minmax(0, 1fr))`;
const providerName = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);

export function OverviewPage() {
  const { t } = useTranslation("dashboard");
  const access = useCapabilities();
  const tenantId = useTenantId();
  const can = {
    analytics: access.can("analytics.read"),
    users: access.can("user.read"),
    audit: access.can("audit.read"),
    connections: access.can("connection.read"),
    policy: access.can("policy.read"),
    tenant: access.can("tenant.read"),
    keys: access.can("apikey.read"),
    webhooks: access.can("webhook.read"),
    billing: access.can("billing.read"),
  };
  const canInvite = access.canAll(["user.read", "user.write", "role.read"]);

  const analytics = useAnalyticsOverview(can.analytics);
  const stats = useUserStats(can.users);
  const invites = useQuery({
    ...invitationQueries.list(tenantId),
    enabled: can.users && !!tenantId,
  });
  const devices = useTrustedDeviceSummary(can.policy);
  const policy = useQuery({
    ...authPolicyQueries.detail(tenantId),
    enabled: can.policy && !!tenantId,
  });
  const social = useSocialProviders(can.connections);
  const saml = useSamlConnections(can.connections);
  const samlApps = useSamlProviders(can.connections);
  const scim = useScimConfig(can.connections);
  const ldap = useLdapConnections(can.connections);
  const clients = useQuery({
    ...oidcClientQueries.list(tenantId),
    enabled: can.connections && !!tenantId,
  });
  const grants = useOAuthGrants(can.connections);
  const domains = useDomains(can.tenant);
  const keys = useQuery({ ...apiKeyQueries.list(tenantId), enabled: can.keys && !!tenantId });
  const webhooks = useQuery({
    ...webhookQueries.list(tenantId),
    enabled: can.webhooks && !!tenantId,
  });
  const anomalies = useAnomalies(can.audit);
  const subscription = useSubscription(can.billing);

  // A backend without the analytics endpoint answers with an empty overview: nothing to chart.
  const overview = analytics.data?.login_trend_14d.length ? analytics.data : undefined;

  const usage = useMemo(
    () => appsInUse(clients.data?.items ?? [], grants.data?.items ?? []),
    [clients.data, grants.data],
  );

  const activeSaml = (saml.data?.items ?? []).filter((c) => c.status === "active");
  const socialNames = (social.data?.items ?? [])
    .filter((p) => p.enabled)
    .map((p) => providerName(p.provider));
  const methodHints: Partial<Record<string, string>> = {
    saml: activeSaml.map((c) => c.name).join(", ") || undefined,
    social: socialNames.join(", ") || undefined,
  };

  const attention = deriveOverviewAttention({
    overview,
    webhooks: webhooks.data?.items,
    apiKeys: keys.data?.items,
    anomalies: anomalies.data?.items,
    userStats: stats.data,
  });
  const attentionLoading =
    [webhooks, keys, anomalies].some((q) => q.isLoading) || (can.analytics && analytics.isLoading);

  const p = policy.data;
  const methods = p
    ? [
        ...(p.passkey_enabled ? [loginMethodLabel("passkey")] : []),
        ...(p.password_enabled ? [loginMethodLabel("password")] : []),
        ...(p.magic_link_enabled ? [loginMethodLabel("magic_link")] : []),
        ...socialNames,
      ]
    : undefined;
  const locale = formatLocale();
  const setup = deriveSetup({
    saml: saml.data?.items,
    samlApps: samlApps.data?.items,
    methods,
    userStats: stats.data,
    pendingInvites: invites.data?.items.filter((i) => i.status === "pending").length,
    domains: domains.data?.items,
    scim: scim.data,
    ldap: ldap.data?.items,
    clients: clients.data?.items,
    unusedClients: usage.unused.length,
    apiKeys: keys.data?.items,
    webhooks: webhooks.data?.items,
    subscription: subscription.data,
    formatDate: (iso) =>
      new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" }),
    formatAmount: (minor, currency) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(minor / 100),
  });
  const setupLoading = [
    stats,
    invites,
    policy,
    social,
    saml,
    samlApps,
    scim,
    ldap,
    clients,
    grants,
    domains,
    keys,
    webhooks,
    subscription,
  ].some((q) => q.isLoading);

  const security: ReactNode[] = [];
  if (overview)
    security.push(
      <SignInMethodsPanel key="methods" overview={overview} hints={methodHints} />,
      <FailedHoursPanel key="hours" overview={overview} />,
    );
  if (stats.data && stats.data.total > 0)
    security.push(
      <TwoStepPanel key="twoStep" stats={stats.data} overview={overview} devices={devices.data} />,
    );

  const peopleAndApps: ReactNode[] = [];
  if (overview) peopleAndApps.push(<ActivePeoplePanel key="active" overview={overview} />);
  if (clients.data)
    peopleAndApps.push(
      <AppsPanel
        key="apps"
        used={usage.used}
        unused={usage.unused}
        people={stats.data?.total ?? 0}
      />,
    );
  if (can.audit) peopleAndApps.push(<RecentActivityPanel key="activity" />);

  return (
    <>
      <PageHeader
        title={t("overview.title")}
        description={t("overview.description")}
        actions={
          canInvite ? (
            <Button icon={UserPlusIcon} render={<Link to="/invitations" />}>
              {t("overview.invite")}
            </Button>
          ) : undefined
        }
      />
      <PageContent>
        <div className="overview">
          {!can.analytics ? (
            <Alert tone="info" title={t("dashboardOverview.yourOperatorViewIsScoped")}>
              {t("dashboardOverview.organizationAnalyticsAreNot")}
            </Alert>
          ) : null}
          {can.analytics && analytics.isError ? (
            <DataState error={analytics.error} onRetry={() => analytics.refetch()} />
          ) : null}

          <PulseBand overview={overview} stats={stats.data} />

          <Group columns={overview ? "minmax(0, 1.55fr) minmax(0, 1fr)" : columns(1)}>
            {overview ? <SignInsPanel overview={overview} /> : null}
            <DataState loading={attentionLoading}>
              <NeedsAttentionPanel items={attention} />
            </DataState>
          </Group>

          {security.length ? (
            <Group label={t("overview.groups.security")} columns={columns(security.length)}>
              {security}
            </Group>
          ) : null}

          {peopleAndApps.length ? (
            <Group label={t("overview.groups.people")} columns={columns(peopleAndApps.length)}>
              {peopleAndApps}
            </Group>
          ) : null}

          {setupLoading || setup.length ? (
            <div className="overview-group">
              <h2 className="overview-group-label">{t("overview.groups.setup")}</h2>
              <DataState loading={setupLoading}>
                <SetupPanel groups={setup} />
              </DataState>
            </div>
          ) : null}
        </div>
      </PageContent>
    </>
  );
}
