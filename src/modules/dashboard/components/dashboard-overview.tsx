import {
  ActivityIcon,
  GaugeIcon,
  KeyRoundIcon,
  RefreshCwIcon,
  RepeatIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UserCheckIcon,
  UserPlusIcon,
  UsersIcon,
} from "@qeetrix/icons";
import {
  Badge,
  Button,
  buttonVariants,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  TimeSince,
} from "@qeetrix/ui";
import { formatLocale, type TranslationKey } from "@/i18n";
import { errorMessage } from "@/platform/errors/user-message";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import type { AccessMode } from "@/platform/security/capability-model";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useApplyOnboardingProfile } from "@/modules/onboarding";
import { formatShortDate, useAnalyticsOverview } from "../api/analytics";

import {
  authMethodColor,
  type DashboardRange,
  formatDelta,
  loginMethodLabel,
  mfaMethodColor,
  mfaMethodLabel,
  takeLatest,
} from "../dashboard-model";
import { OperatorActionsPanel, RecentActivityPanel } from "./dashboard-activity";
import {
  AuthenticationActivityPanel,
  FailedLoginsPanel,
  LoginMethodMixPanel,
  MfaAdoptionPanel,
} from "./dashboard-charts";
import {
  AttentionRequiredPanel,
  IdentityHealthPanel,
  SecurityPosturePanel,
  SessionOverviewPanel,
} from "./dashboard-insights";
import { EnterpriseOverviewPanel, PlanUsagePanel } from "./dashboard-insights-enterprise";
import {
  type DashboardMetric,
  DashboardMetricRail,
  DashboardSecondaryRail,
} from "./dashboard-metrics";
import { OnboardingChecklist } from "./onboarding-checklist";
import { PasskeyPromptCard } from "./passkey-prompt-card";

const ACCESS_MODE_KEYS: Record<AccessMode, TranslationKey> = {
  setup: "dashboard:dashboardOverview.accessMode.setup",
  full: "dashboard:dashboardOverview.accessMode.full",
  "read-only": "dashboard:dashboardOverview.accessMode.readOnly",
  restricted: "dashboard:dashboardOverview.accessMode.restricted",
  none: "dashboard:dashboardOverview.accessMode.none",
  unknown: "dashboard:dashboardOverview.accessMode.unknown",
};

function hasLiveTelemetry(generatedAt: string | undefined): generatedAt is string {
  if (!generatedAt) return false;
  const timestamp = new Date(generatedAt).getTime();
  return Number.isFinite(timestamp) && timestamp > 0;
}

function DashboardHeading({
  range,
  onRangeChange,
  generatedAt,
  loading,
  telemetryAvailable,
  canInvite,
}: {
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
  generatedAt?: string;
  loading: boolean;
  telemetryAvailable: boolean;
  canInvite: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const live = hasLiveTelemetry(generatedAt);

  return (
    <header className="flex flex-col gap-5 border-b border-border/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <span className="h-px w-5 bg-primary" aria-hidden="true" />
          {t("dashboardOverview.identityOperations")}
        </div>
        <h1 className="text-balance font-heading text-3xl font-semibold tracking-[-0.04em] sm:text-[2.25rem]">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {telemetryAvailable ? (
          <>
            <div className="me-1 flex min-h-8 items-center gap-2 rounded-lg border border-border/75 bg-card/70 px-2.5 text-[11px] text-muted-foreground">
              {loading ? (
                <Skeleton className="h-3 w-28" />
              ) : (
                <>
                  <span
                    className={`size-1.5 rounded-full ${live ? "bg-success shadow-[0_0_0_3px_color-mix(in_oklab,var(--success)_16%,transparent)]" : "bg-warning"}`}
                    aria-hidden="true"
                  />
                  {live ? (
                    <span>
                      <Trans
                        t={t}
                        i18nKey="dashboardOverview.telemetryUpdated"
                        components={{
                          time: <TimeSince value={generatedAt} className="font-medium" />,
                        }}
                      />
                    </span>
                  ) : (
                    <span>{t("dashboardOverview.awaitingOrganizationTelemetry")}</span>
                  )}
                </>
              )}
            </div>
            <Select
              value={range}
              onValueChange={(value) => value && onRangeChange(value as DashboardRange)}
            >
              <SelectTrigger
                size="sm"
                className="min-w-36 bg-card"
                aria-label={t("dashboardOverview.range")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">{t("range7d")}</SelectItem>
                <SelectItem value="14d">{t("range14d")}</SelectItem>
              </SelectContent>
            </Select>
          </>
        ) : null}
        {canInvite ? (
          <Link to="/invitations" className={buttonVariants({ size: "sm" })}>
            <UserPlusIcon /> {t("quickActions.inviteLabel")}
          </Link>
        ) : null}
      </div>
    </header>
  );
}

export function DashboardOverview() {
  const { t, i18n } = useTranslation("dashboard");
  useApplyOnboardingProfile(); // persist creation-time segmentation on first load
  const access = useCapabilities();
  const canViewAnalytics = access.can("analytics.read");
  const canViewAudit = access.can("audit.read");
  const canViewConnections = access.can("connection.read");
  const canViewBilling = access.can("billing.read");
  const canInvite = access.canAll(["user.read", "user.write", "role.read"]);
  const analytics = useAnalyticsOverview(canViewAnalytics);
  const [range, setRange] = useState<DashboardRange>("14d");
  const take = range === "7d" ? 7 : 14;

  if (canViewAnalytics && analytics.isError) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <DashboardHeading
          range={range}
          onRangeChange={setRange}
          loading={false}
          telemetryAvailable
          canInvite={canInvite}
        />
        <section className="enterprise-panel grid min-h-80 place-items-center p-8 text-center">
          <div className="max-w-md">
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <TriangleAlertIcon className="size-5" />
            </span>
            <h2 className="mt-4 font-heading text-lg font-semibold">{t("error")}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {analytics.error instanceof Error
                ? errorMessage(analytics.error)
                : t("dashboardOverview.analyticsNoResponse")}
            </p>
            <Button className="mt-5" variant="outline" onClick={() => analytics.refetch()}>
              <RefreshCwIcon /> {t("dashboardOverview.retry")}
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const overview = analytics.data;
  const metricData = {
    users: takeLatest(overview?.user_trend_14d ?? [], take).map((point) => point.value),
    logins: takeLatest(overview?.login_trend_14d ?? [], take).map((point) => point.value),
    mfa: takeLatest(overview?.mfa_trend_14d ?? [], take).map((point) => point.value),
    failed: takeLatest(overview?.failed_trend_14d ?? [], take).map((point) => point.value),
  };

  const metrics: DashboardMetric[] = overview
    ? [
        {
          id: "mau",
          icon: UsersIcon,
          label: t("kpi.mau"),
          value: overview.kpis.mau.value.toLocaleString(formatLocale()),
          delta: overview.kpis.mau.delta_pct,
          favorable: overview.kpis.mau.delta_pct >= 0,
          data: metricData.users,
          tone: "info",
        },
        {
          id: "logins",
          icon: ActivityIcon,
          label: t("kpi.loginsToday"),
          value: overview.kpis.logins_today.value.toLocaleString(formatLocale()),
          delta: overview.kpis.logins_today.delta_pct,
          favorable: overview.kpis.logins_today.delta_pct >= 0,
          data: metricData.logins,
          tone: "brand",
        },
        {
          id: "mfa",
          icon: KeyRoundIcon,
          label: t("kpi.mfaAdoption"),
          value: `${overview.kpis.mfa_adoption_pct.value.toFixed(1)}%`,
          delta: overview.kpis.mfa_adoption_pct.delta_pct,
          unit: "pp",
          favorable: overview.kpis.mfa_adoption_pct.delta_pct >= 0,
          data: metricData.mfa,
          variant: "line",
          tone: "success",
        },
        {
          id: "failed",
          icon: ShieldCheckIcon,
          label: t("kpi.failedLogins24h"),
          value: overview.kpis.failed_logins_24h.value.toLocaleString(formatLocale()),
          delta: overview.kpis.failed_logins_24h.delta_pct,
          favorable: overview.kpis.failed_logins_24h.delta_pct <= 0,
          data: metricData.failed,
          variant: "line",
          tone: "danger",
        },
      ]
    : [];

  const secondaryStats = overview
    ? [
        {
          id: "total",
          icon: <UsersIcon />,
          label: t("stats.totalUsers"),
          value: overview.kpis.total_users.value.toLocaleString(formatLocale()),
        },
        {
          id: "daily",
          icon: <UserCheckIcon />,
          label: t("stats.dailyActive"),
          value: overview.kpis.dau.value.toLocaleString(formatLocale()),
          detail: formatDelta(overview.kpis.dau.delta_pct),
        },
        {
          id: "stickiness",
          icon: <GaugeIcon />,
          label: t("stats.stickiness"),
          value: `${overview.kpis.stickiness_pct.value.toFixed(0)}%`,
        },
        {
          id: "sessions",
          icon: <RepeatIcon />,
          label: t("stats.avgSessions"),
          value: overview.kpis.avg_sessions_per_user.value.toFixed(1),
        },
      ]
    : [];

  const authenticationRows = takeLatest(overview?.login_activity_14d ?? [], take).map((point) => ({
    day: formatShortDate(point.date),
    password: point.password,
    passkey: point.passkey,
    social: point.social,
    saml: point.saml,
    oidc: point.oidc,
    magic_link: point.magic_link ?? 0,
    ldap: point.ldap ?? 0,
  }));
  const methodRows = (overview?.login_methods_mix ?? []).map((method) => ({
    method: method.method,
    label: loginMethodLabel(method.method),
    value: method.value,
    fill: authMethodColor(method.method),
  }));
  const mfaRows = (overview?.mfa_methods_adoption ?? []).map((method) => ({
    method: method.method,
    label: mfaMethodLabel(method.method),
    users: method.users,
    fill: mfaMethodColor(method.method),
  }));

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardHeading
        range={range}
        onRangeChange={setRange}
        generatedAt={overview?.generated_at}
        loading={analytics.isLoading}
        telemetryAvailable={canViewAnalytics}
        canInvite={canInvite}
      />

      {canViewAnalytics ? (
        <>
          <DashboardMetricRail metrics={metrics} loading={analytics.isLoading || !overview} />
          {overview ? <DashboardSecondaryRail items={secondaryStats} /> : null}
        </>
      ) : (
        <section className="enterprise-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
              <ShieldCheckIcon className="size-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="font-heading text-base font-semibold">
                {t("dashboardOverview.yourOperatorViewIsScoped")}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t("dashboardOverview.organizationAnalyticsAreNot")}
              </p>
            </div>
          </div>
          <Badge variant="muted" className="w-fit shrink-0">
            {i18n.t(ACCESS_MODE_KEYS[access.mode])}
          </Badge>
        </section>
      )}

      {canViewAnalytics ? (
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12">
          <AttentionRequiredPanel
            className="xl:col-span-5"
            overview={overview}
            loading={analytics.isLoading}
          />
          <IdentityHealthPanel
            className="xl:col-span-4"
            overview={overview}
            loading={analytics.isLoading}
          />
          <SessionOverviewPanel
            className="xl:col-span-3"
            overview={overview}
            loading={analytics.isLoading}
          />
        </div>
      ) : null}

      <div className="grid gap-3">
        <OnboardingChecklist />
        <PasskeyPromptCard />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12">
        {canViewAnalytics ? (
          <>
            <AuthenticationActivityPanel
              className="xl:col-span-8"
              rows={authenticationRows}
              loading={analytics.isLoading}
              take={take}
            />
            <LoginMethodMixPanel
              className="xl:col-span-4"
              rows={methodRows}
              loading={analytics.isLoading}
            />
            <MfaAdoptionPanel
              className="xl:col-span-6"
              rows={mfaRows}
              loading={analytics.isLoading}
            />
            <FailedLoginsPanel
              className="xl:col-span-6"
              rows={overview?.failed_logins_hourly_24h ?? []}
              loading={analytics.isLoading}
            />
          </>
        ) : null}
        {canViewAudit ? <RecentActivityPanel className="xl:col-span-8" /> : null}
        <OperatorActionsPanel className="xl:col-span-4" />
      </div>

      {canViewAnalytics || canViewConnections || canViewBilling ? (
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12">
          {canViewAnalytics ? (
            <SecurityPosturePanel
              className="xl:col-span-4"
              overview={overview}
              loading={analytics.isLoading}
            />
          ) : null}
          {canViewConnections ? <EnterpriseOverviewPanel className="xl:col-span-4" /> : null}
          {canViewBilling ? <PlanUsagePanel className="xl:col-span-4" /> : null}
        </div>
      ) : null}
    </div>
  );
}
