import { Badge, buttonVariants, cn, EmptyState, Skeleton, TimeSince } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FingerprintIcon,
  LightbulbIcon,
  LinkIcon,
  MonitorSmartphoneIcon,
  ShareIcon,
  TrendingUpIcon,
  UserRoundIcon,
} from "lucide-react";
import type { ReactNode } from "react";
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
  type AuthPostureId,
  countSignInMethods,
  deriveAuthPosture,
  resolveMfaCoverage,
} from "../authentication-overview-model";
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
 * Everything the view renders. The view calls no hook but `useTranslation`, so
 * every state below is reachable from a fixture in a test — the split
 * `directory-overview.tsx` uses for the same reason.
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
          icon={<FingerprintIcon />}
          tone="success"
          label={t("overview.kpi.mfa.label")}
          value={`${Math.round(mfa.pct)}%`}
          detail={t("overview.kpi.mfa.detail")}
          loading={data.analytics.isPending && data.userStats.isPending}
          error={false}
          // The ONLY trend on this page. It is a percentage-point move against
          // 7 days ago, not a 30-day percent change, so it says so.
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
                icon={<FingerprintIcon />}
                tone="success"
                title={t("overview.areas.mfa.title")}
                description={t("overview.areas.mfa.description")}
                stat={t("overview.areas.mfa.stat", { pct: Math.round(mfa.pct) })}
                chips={mfaMethodChips(data.analytics.data)}
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

          {perm.audit ? (
            <DashboardPanel
              title={t("overview.activity.title")}
              description={t("overview.activity.description")}
              action={
                <Link
                  to="/activity"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
                >
                  {t("overview.activity.viewAll")} <ChevronRightIcon />
                </Link>
              }
            >
              {data.activity.connecting && data.activity.events.length === 0 ? (
                <div className="flex flex-col gap-2">
                  {["a", "b", "c"].map((k) => (
                    <Skeleton key={k} className="h-10 w-full" />
                  ))}
                </div>
              ) : data.activity.events.length === 0 ? (
                <EmptyState
                  icon={ActivityIcon}
                  title={t("overview.activity.emptyTitle")}
                  description={t("overview.activity.emptyDescription")}
                />
              ) : (
                <ol className="flex flex-col">
                  {data.activity.events.slice(0, 5).map((event) => (
                    <li
                      key={event.id}
                      className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                        <ActivityIcon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{event.title}</span>
                      {event.actor?.name ? (
                        <span className="hidden shrink-0 truncate text-xs text-muted-foreground sm:block">
                          {event.actor.name}
                        </span>
                      ) : null}
                      <TimeSince
                        value={event.at}
                        refreshIntervalMs={0}
                        className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                      />
                    </li>
                  ))}
                </ol>
              )}
            </DashboardPanel>
          ) : null}
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
                    <CheckCircle2Icon className="size-4 shrink-0 text-success" />
                  ) : (
                    <AlertTriangleIcon className="size-4 shrink-0 text-warning" />
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

// ---------------------------------------------------------------------------

const TONES = {
  brand: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  neutral: "bg-muted text-muted-foreground ring-1 ring-foreground/6",
} as const;

type Tone = keyof typeof TONES;

function postureBadge(state: "healthy" | "attention" | "critical") {
  if (state === "healthy") return "success" as const;
  if (state === "attention") return "warning" as const;
  return "destructive" as const;
}

function actionIcon(id: AuthPostureId): ReactNode {
  switch (id) {
    case "signin":
      return <UserRoundIcon />;
    case "social":
      return <ShareIcon />;
    case "mfa":
      return <FingerprintIcon />;
    case "sso":
      return <LinkIcon />;
    default:
      return <MonitorSmartphoneIcon />;
  }
}

/**
 * "github" is not "Github". Title-casing the raw id gets the common cases wrong,
 * so the handful with internal capitals are spelled out.
 */
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

function enabledMethodChips(policy: AuthPolicy | undefined, t: (k: string) => string): string[] {
  if (!policy) return [];
  const map: [boolean, string][] = [
    [policy.password_enabled, "overview.areas.methods.password"],
    [policy.passkey_enabled, "overview.areas.methods.passkey"],
    [policy.magic_link_enabled, "overview.areas.methods.magicLink"],
    [policy.otp_email_enabled, "overview.areas.methods.otpEmail"],
    [policy.otp_sms_enabled, "overview.areas.methods.otpSms"],
  ];
  return map.filter(([on]) => on).map(([, key]) => t(key));
}

function mfaMethodChips(analytics: AnalyticsOverview | undefined): string[] {
  return (analytics?.mfa_methods_adoption ?? [])
    .filter((m) => m.users > 0)
    .slice(0, 3)
    .map((m) => `${m.method} ${m.users}`);
}

function Callout({ posture }: { posture: ReturnType<typeof deriveAuthPosture> }) {
  const { t } = useTranslation("auth");
  const next = posture.pending[0];

  return (
    <div className="mt-4 flex items-start gap-3 rounded-lg border border-primary/15 bg-primary/3 p-3 dark:border-primary/20 dark:bg-primary/5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <LightbulbIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {next ? t("overview.posture.callout.title") : t("overview.posture.callout.allClear")}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {next
            ? t(`overview.actions.items.${next.id}.description`)
            : t("overview.posture.callout.allClearDetail")}
        </p>
      </div>
      {next ? (
        <Link to={next.to as never} aria-label={t(`overview.actions.items.${next.id}.title`)}>
          <ArrowRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}
    </div>
  );
}

function Kpi({
  icon,
  tone,
  label,
  value,
  detail,
  loading,
  error,
  delta,
}: {
  icon: ReactNode;
  tone: Tone;
  label: string;
  value: number | string;
  detail: string;
  loading: boolean;
  error: boolean;
  delta?: { value: number; caption: string };
}) {
  const { t } = useTranslation("auth");
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <span
        className={cn(
          "mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-4.5",
          TONES[tone],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="font-heading text-2xl font-semibold tabular-nums">
            {loading ? "—" : error ? "—" : value}
          </span>
          {!loading && !error && delta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                delta.value >= 0 ? "text-success" : "text-destructive",
              )}
            >
              <TrendingUpIcon className="size-3" />
              {delta.value >= 0 ? "+" : ""}
              {delta.value.toFixed(1)}pp
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {error ? t("overview.states.unavailable") : delta ? delta.caption : detail}
        </p>
      </div>
    </div>
  );
}

function Area({
  to,
  icon,
  tone,
  title,
  description,
  stat,
  chips,
  wide,
}: {
  to: string;
  icon: ReactNode;
  tone: Tone;
  title: string;
  description: string;
  stat: string;
  chips: string[];
  wide?: boolean;
}) {
  return (
    <Link
      to={to as never}
      className={cn(
        "group flex items-start gap-4 border-t border-border/70 p-5 outline-none transition-colors hover:bg-muted/35 focus-visible:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        wide ? "md:col-span-2" : "md:odd:border-e",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-4.5",
          TONES[tone],
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
        <span className="mt-2 block text-sm font-medium">{stat}</span>
        {chips.length > 0 ? (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <Badge key={c} variant="muted">
                {c}
              </Badge>
            ))}
          </span>
        ) : null}
      </span>
      <ChevronRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
