import { Badge, buttonVariants, cn } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  CircleCheckIcon,
  ExternalLinkIcon,
  FingerprintPatternIcon,
  LinkIcon,
  MonitorSmartphoneIcon,
  ShareIcon,
  TriangleAlertIcon,
  UserRoundIcon,
} from "@qeetrix/icons";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import {
  type AuthPolicy,
  type SamlConnection,
  type SamlProvider,
  type SocialProvider,
  type TrustedDeviceSummary,
  useAuthPolicy,
  useSamlConnections,
  useSamlProviders,
  useSocialProviders,
  useTrustedDeviceSummary,
} from "@/modules/authentication";
import { type AnalyticsOverview, useAnalyticsOverview } from "../api/analytics";
import {
  countSignInMethods,
  deriveAuthPosture,
  resolveMfaCoverage,
} from "../authentication-overview-model";
import { mfaMethodLabel } from "../dashboard-model";
import {
  Area,
  actionIcon,
  Callout,
  Kpi,
  postureBadge,
  RecentAuthActivity,
} from "./authentication-overview-cards";
import { DashboardPanel } from "./dashboard-panel";
import { HealthGauge } from "./health-gauge";
import { type DashboardAuditEvent, useDashboardActivity } from "../use-dashboard-activity";
import { type UserStats, useUserStats } from "@/modules/users";
import { PageHeader } from "@/platform/components/page-header";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";

const DOCS = "https://docs.qeet.in/qeet-id/authentication";

type QueryState = { isPending: boolean; isError: boolean };

/**
 * Everything the view renders. The view calls no hook but `useTranslation`, so every state below
 * is reachable from a test fixture.
 */
export type AuthOverviewViewData = {
  tenantId: string | null;
  permissions: {
    policy: boolean;
    connections: boolean;
    users: boolean;
    analytics: boolean;
    audit: boolean;
  };
  policy: QueryState & { data?: AuthPolicy };
  social: QueryState & { data?: SocialProvider[] };
  saml: QueryState & { data?: SamlConnection[] };
  samlIdp: QueryState & { data?: SamlProvider[] };
  analytics: QueryState & { data?: AnalyticsOverview };
  userStats: QueryState & { data?: UserStats };
  devices: QueryState & { data?: TrustedDeviceSummary };
  activity: { events: DashboardAuditEvent[]; connecting: boolean };
};

export function AuthenticationOverview() {
  const access = useCapabilities();
  const tenantId = useTenantId();

  const canPolicy = access.can("policy.read");
  const canConnections = access.can("connection.read");
  const canUsers = access.can("user.read");
  const canAnalytics = access.can("analytics.read");
  const canAudit = access.can("audit.read");

  const policy = useAuthPolicy();
  const social = useSocialProviders(canConnections);
  const saml = useSamlConnections();
  const samlIdp = useSamlProviders();
  const analytics = useAnalyticsOverview(canAnalytics);
  const userStats = useUserStats(canUsers);
  const devices = useTrustedDeviceSummary(canConnections);
  const activity = useDashboardActivity(undefined, canAudit);

  return (
    <AuthenticationOverviewView
      data={{
        tenantId,
        permissions: {
          policy: canPolicy,
          connections: canConnections,
          users: canUsers,
          analytics: canAnalytics,
          audit: canAudit,
        },
        policy: { isPending: policy.isPending, isError: policy.isError, data: policy.data },
        social: {
          isPending: social.isPending,
          isError: social.isError,
          data: social.data?.items,
        },
        saml: { isPending: saml.isPending, isError: saml.isError, data: saml.data?.items },
        samlIdp: {
          isPending: samlIdp.isPending,
          isError: samlIdp.isError,
          data: samlIdp.data?.items,
        },
        analytics: {
          isPending: analytics.isPending,
          isError: analytics.isError,
          data: analytics.data,
        },
        userStats: {
          isPending: userStats.isPending,
          isError: userStats.isError,
          data: userStats.data,
        },
        devices: { isPending: devices.isPending, isError: devices.isError, data: devices.data },
        activity: { events: activity.events, connecting: activity.connecting },
      }}
    />
  );
}

export function AuthenticationOverviewView({ data }: { data: AuthOverviewViewData }) {
  const { t } = useTranslation("auth");
  const { permissions: perm } = data;

  const socialEnabled = (data.social.data ?? []).filter((p) => p.enabled);
  const samlIn = data.saml.data?.length ?? 0;
  const samlOut = data.samlIdp.data?.length ?? 0;
  const signInCount = countSignInMethods(data.policy.data);
  const mfa = resolveMfaCoverage(data.analytics.data, data.userStats.data);
  const deviceSummary = data.devices.data;

  const posture = deriveAuthPosture({
    signInMethodsEnabled: signInCount,
    socialEnabled: socialEnabled.length,
    ssoConnections: samlIn + samlOut,
    mfaCoveragePct: mfa.pct,
    trustedDevices: deviceSummary?.devices ?? 0,
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("overview.description")} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          icon={<UserRoundIcon />}
          tone="brand"
          label={t("overview.kpi.signIn.label")}
          value={signInCount}
          detail={t("overview.kpi.signIn.detail", { count: signInCount })}
          loading={data.policy.isPending}
          error={data.policy.isError}
        />
        {perm.connections ? (
          <Kpi
            icon={<ShareIcon />}
            tone="info"
            label={t("overview.kpi.social.label")}
            value={socialEnabled.length}
            detail={
              socialEnabled.length > 0
                ? socialEnabled.map((p) => providerLabel(p.provider)).join(", ")
                : t("overview.kpi.social.none")
            }
            loading={data.social.isPending}
            error={data.social.isError}
          />
        ) : null}
        {perm.connections ? (
          <Kpi
            icon={<LinkIcon />}
            tone="neutral"
            label={t("overview.kpi.sso.label")}
            value={samlIn + samlOut}
            detail={t("overview.kpi.sso.detail", { inbound: samlIn, outbound: samlOut })}
            loading={data.saml.isPending}
            error={data.saml.isError}
          />
        ) : null}
        <Kpi
          icon={<FingerprintPatternIcon />}
          tone="success"
          label={t("overview.kpi.mfa.label")}
          value={`${Math.round(mfa.pct)}%`}
          detail={t("overview.kpi.mfa.detail")}
          loading={data.analytics.isPending && data.userStats.isPending}
          error={false}
          // The page's only trend: a percentage-point move over 7 days, captioned as such.
          delta={
            mfa.deltaPp !== undefined && Math.abs(mfa.deltaPp) >= 0.1
              ? { value: mfa.deltaPp, caption: t("overview.kpi.mfa.delta") }
              : undefined
          }
        />
        {perm.connections ? (
          <Kpi
            icon={<MonitorSmartphoneIcon />}
            tone="neutral"
            label={t("overview.kpi.devices.label")}
            value={deviceSummary?.devices ?? 0}
            detail={
              deviceSummary && deviceSummary.devices > 0
                ? t("overview.kpi.devices.detail", { count: deviceSummary.users })
                : t("overview.kpi.devices.none")
            }
            loading={data.devices.isPending}
            error={data.devices.isError}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
          <DashboardPanel
            title={t("overview.areas.title")}
            description={t("overview.areas.description")}
            contentClassName="p-0"
            action={
              <a
                href={DOCS}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
              >
                {t("overview.areas.documentation")} <ExternalLinkIcon />
              </a>
            }
          >
            <nav aria-label={t("overview.areas.title")} className="grid md:grid-cols-2">
              <Area
                to="/auth/login-methods/password"
                icon={<UserRoundIcon />}
                tone="brand"
                title={t("overview.areas.signin.title")}
                description={t("overview.areas.signin.description")}
                stat={t("overview.areas.signin.stat", { count: signInCount })}
                chips={enabledMethodChips(data.policy.data, t)}
              />
              {perm.connections ? (
                <Area
                  to="/auth/social"
                  icon={<ShareIcon />}
                  tone="info"
                  title={t("overview.areas.social.title")}
                  description={t("overview.areas.social.description")}
                  stat={t("overview.areas.social.stat", { count: socialEnabled.length })}
                  chips={socialEnabled.slice(0, 4).map((p) => providerLabel(p.provider))}
                />
              ) : null}
              {perm.connections ? (
                <Area
                  to="/auth/connections/saml"
                  icon={<LinkIcon />}
                  tone="neutral"
                  title={t("overview.areas.sso.title")}
                  description={t("overview.areas.sso.description")}
                  stat={t("overview.areas.sso.stat", { count: samlIn + samlOut })}
                  chips={[
                    t("overview.areas.chips.samlIn", { count: samlIn }),
                    t("overview.areas.chips.samlOut", { count: samlOut }),
                  ]}
                />
              ) : null}
              <Area
                to="/auth/mfa/totp"
                icon={<FingerprintPatternIcon />}
                tone="success"
                title={t("overview.areas.mfa.title")}
                description={t("overview.areas.mfa.description")}
                stat={t("overview.areas.mfa.stat", { pct: Math.round(mfa.pct) })}
                chips={mfaMethodChips(data.analytics.data, t)}
              />
              {perm.connections ? (
                <Area
                  to="/security/device-authorizations"
                  icon={<MonitorSmartphoneIcon />}
                  tone="neutral"
                  wide
                  title={t("overview.areas.devices.title")}
                  description={t("overview.areas.devices.description")}
                  stat={t("overview.areas.devices.stat", {
                    count: deviceSummary?.devices ?? 0,
                  })}
                  chips={[
                    data.policy.data?.remember_device_enabled
                      ? t("overview.areas.chips.rememberOn")
                      : t("overview.areas.chips.rememberOff"),
                  ]}
                />
              ) : null}
            </nav>
          </DashboardPanel>

          {perm.audit ? <RecentAuthActivity activity={data.activity} /> : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <DashboardPanel
            title={t("overview.posture.title")}
            action={
              <Badge variant={postureBadge(posture.state)} className="shrink-0">
                {t(`overview.posture.state.${posture.state}`)}
              </Badge>
            }
          >
            <div className="flex items-center gap-4">
              <HealthGauge
                score={posture.score}
                size={104}
                stroke={8}
                readout={`${posture.score}%`}
                caption={t("overview.posture.overall")}
                ariaLabel={t("overview.posture.title")}
              />
              <p className="min-w-0 text-sm leading-5 text-muted-foreground">
                {t(`overview.posture.summary.${posture.state}`)}
              </p>
            </div>

            <ul className="mt-4 flex flex-col gap-2">
              {posture.items.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  {item.ok ? (
                    <CircleCheckIcon className="size-4 shrink-0 text-success" />
                  ) : (
                    <TriangleAlertIcon className="size-4 shrink-0 text-warning" />
                  )}
                  <span className={cn("min-w-0 truncate", item.ok ? "" : "text-muted-foreground")}>
                    {t(`overview.posture.items.${item.id}`)}
                  </span>
                </li>
              ))}
            </ul>

            <Callout posture={posture} />
          </DashboardPanel>

          <DashboardPanel
            title={t("overview.actions.title")}
            action={
              posture.pending.length > 0 ? (
                <Badge variant="muted" className="shrink-0 tabular-nums">
                  {t("overview.actions.pending", { count: posture.pending.length })}
                </Badge>
              ) : null
            }
          >
            {posture.pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("overview.posture.callout.allClearDetail")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {posture.pending.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/35"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
                      {actionIcon(item.id)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {t(`overview.actions.items.${item.id}.title`)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t(`overview.actions.items.${item.id}.description`)}
                      </span>
                    </span>
                    <Link
                      to={item.to as never}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
                    >
                      {t(`overview.actions.items.${item.id}.verb`)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
}

/** Display names that title-casing the raw id would get wrong ("github" → "GitHub"). */
const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  gitlab: "GitLab",
  x: "X",
  qeet: "Qeet",
};

function providerLabel(id: string): string {
  return PROVIDER_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

function enabledMethodChips(policy: AuthPolicy | undefined, t: TFunction): string[] {
  if (!policy) return [];
  const map: [boolean, string][] = [
    [policy.password_enabled, "overview.areas.methods.password"],
    [policy.passkey_enabled, "overview.areas.methods.passkey"],
    [policy.magic_link_enabled, "overview.areas.methods.magicLink"],
  ];
  return map.filter(([on]) => on).map(([, key]) => t(key));
}

function mfaMethodChips(analytics: AnalyticsOverview | undefined, t: TFunction): string[] {
  return (analytics?.mfa_methods_adoption ?? [])
    .filter((m) => m.users > 0)
    .slice(0, 3)
    .map((m) =>
      t("dashboard:authenticationOverview.mfaChip", {
        method: mfaMethodLabel(m.method),
        count: m.users,
      }),
    );
}
