import {
  buttonVariants,
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  cn,
  EmptyState,
  Skeleton,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { ActivityIcon, KeyRoundIcon, ShieldAlertIcon } from "@qeetrix/icons";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { AUTH_METHOD_KEYS } from "../dashboard-model";
import { DashboardPanel } from "./dashboard-panel";

function activityConfig(t: TFunction) {
  return {
    password: { label: t("dashboardCharts.methods.password"), color: "var(--chart-1)" },
    passkey: { label: t("dashboardCharts.methods.passkey"), color: "var(--chart-2)" },
    social: { label: t("dashboardCharts.methods.social"), color: "var(--chart-3)" },
    saml: { label: "SAML", color: "var(--chart-4)" },
    oidc: { label: "OIDC", color: "var(--chart-5)" },
  } satisfies ChartConfig;
}

function mfaConfig(t: TFunction) {
  return {
    users: { label: t("dashboardCharts.users") },
    totp: { label: "TOTP", color: "var(--chart-1)" },
    passkey: { label: t("dashboardCharts.mfaMethods.passkey"), color: "var(--chart-2)" },
    sms: { label: "SMS", color: "var(--chart-3)" },
    email: { label: t("dashboardCharts.mfaMethods.email"), color: "var(--chart-4)" },
    recovery: { label: t("dashboardCharts.mfaMethods.recovery"), color: "var(--chart-5)" },
  } satisfies ChartConfig;
}

function failedConfig(t: TFunction) {
  return {
    attempts: { label: t("dashboardCharts.failedAttempts"), color: "var(--chart-5)" },
  } satisfies ChartConfig;
}

const MIX_SKELETON_IDS = ["password", "passkey", "social", "saml", "oidc"] as const;

export type AuthenticationActivityRow = {
  day: string;
  password: number;
  passkey: number;
  social: number;
  saml: number;
  oidc: number;
};

export type MethodMixRow = {
  method: string;
  label: string;
  value: number;
  fill: string;
};

export type MfaAdoptionRow = {
  method: string;
  label: string;
  users: number;
  fill: string;
};

export type FailedLoginRow = {
  hour: string;
  attempts: number;
};

function ChartSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-72 w-full rounded-lg", className)} />;
}

export function AuthenticationActivityPanel({
  rows,
  loading,
  take,
  className,
}: {
  rows: AuthenticationActivityRow[];
  loading: boolean;
  take: number;
  className?: string;
}) {
  const { t } = useTranslation("dashboard");
  const config = activityConfig(t);

  return (
    <DashboardPanel
      className={className}
      title={t("charts.authActivity.title")}
      description={t("charts.authActivity.description", { take })}
      action={
        <Link to="/analytics" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          {t("charts.viewAnalytics")}
        </Link>
      }
    >
      {loading ? (
        <ChartSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title={t("charts.authActivity.emptyTitle")}
          description={t("charts.authActivity.emptyDescription")}
        />
      ) : (
        <figure>
          <ChartContainer
            config={config}
            className="aspect-auto h-72 w-full"
            role="img"
            aria-label={t("dashboardCharts.activityLabel", { count: take })}
          >
            <AreaChart data={rows} accessibilityLayer>
              <defs>
                {AUTH_METHOD_KEYS.map((key) => (
                  <linearGradient key={key} id={`activity-fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={`var(--color-${key})`} stopOpacity={0.42} />
                    <stop offset="100%" stopColor={`var(--color-${key})`} stopOpacity={0.025} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 5" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={38} />
              <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
              <ChartLegend content={<ChartLegendContent />} />
              {(["oidc", "saml", "social", "passkey", "password"] as const).map((key) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="authentication"
                  stroke={`var(--color-${key})`}
                  fill={`url(#activity-fill-${key})`}
                  strokeWidth={1.5}
                />
              ))}
            </AreaChart>
          </ChartContainer>
          <table className="sr-only">
            <caption>{t("dashboardCharts.authenticationActivityByDay")}</caption>
            <thead>
              <tr>
                <th>{t("dashboardCharts.day")}</th>
                {AUTH_METHOD_KEYS.map((method) => (
                  <th key={method}>{config[method].label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.day}>
                  <th>{row.day}</th>
                  {AUTH_METHOD_KEYS.map((method) => (
                    <td key={method}>{row[method]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      )}
    </DashboardPanel>
  );
}

export function LoginMethodMixPanel({
  rows,
  loading,
  className,
}: {
  rows: MethodMixRow[];
  loading: boolean;
  className?: string;
}) {
  const { t } = useTranslation("dashboard");
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <DashboardPanel
      className={className}
      title={t("charts.loginMix.title")}
      description={t("charts.loginMix.description")}
    >
      {loading ? (
        <div className="space-y-5" aria-hidden="true">
          {MIX_SKELETON_IDS.map((id) => (
            <div key={id} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title={t("charts.loginMix.emptyTitle")}
          description={t("charts.loginMix.emptyDescription")}
        />
      ) : (
        <ol className="space-y-4" aria-label={t("dashboardCharts.signInsByAuthenticationMethod")}>
          {rows.map((row) => {
            const percentage = total > 0 ? (row.value / total) * 100 : 0;
            return (
              <li key={row.method}>
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span
                      className="size-2 shrink-0 rounded-xs"
                      style={{ backgroundColor: row.fill }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{row.label}</span>
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
                <div
                  className="dashboard-method-track"
                  role="progressbar"
                  aria-label={t("dashboardCharts.methodShare", {
                    method: row.label,
                    pct: percentage.toFixed(1),
                  })}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(percentage)}
                >
                  <div
                    className="dashboard-method-fill w-full"
                    style={{
                      backgroundColor: row.fill,
                      transform: `scaleX(${percentage / 100})`,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </DashboardPanel>
  );
}

export function MfaAdoptionPanel({
  rows,
  loading,
  className,
}: {
  rows: MfaAdoptionRow[];
  loading: boolean;
  className?: string;
}) {
  const { t } = useTranslation("dashboard");

  return (
    <DashboardPanel
      className={className}
      title={t("charts.mfa.title")}
      description={t("charts.mfa.description")}
    >
      {loading ? (
        <ChartSkeleton className="h-64" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={KeyRoundIcon}
          title={t("charts.mfa.emptyTitle")}
          description={t("charts.mfa.emptyDescription")}
        />
      ) : (
        <figure>
          <ChartContainer
            config={mfaConfig(t)}
            className="aspect-auto h-64 w-full"
            role="img"
            aria-label={t("dashboardCharts.numberOfUsersEnrolled")}
          >
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 2, left: 8, right: 24, bottom: 2 }}
              accessibilityLayer
            >
              <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="2 5" />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={104}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="users" radius={[0, 4, 4, 0]} barSize={18}>
                {rows.map((row) => (
                  <Cell key={row.method} fill={row.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          <table className="sr-only">
            <caption>{t("dashboardCharts.mfaEnrollmentByMethod")}</caption>
            <thead>
              <tr>
                <th>{t("dashboardCharts.method")}</th>
                <th>{t("dashboardCharts.users")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.method}>
                  <th>{row.label}</th>
                  <td>{row.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      )}
    </DashboardPanel>
  );
}

export function FailedLoginsPanel({
  rows,
  loading,
  className,
}: {
  rows: FailedLoginRow[];
  loading: boolean;
  className?: string;
}) {
  const { t } = useTranslation("dashboard");

  return (
    <DashboardPanel
      className={className}
      title={t("charts.failedLogins.title")}
      description={t("charts.failedLogins.description")}
      action={
        <Link
          to="/security/audit-logs"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {t("charts.viewLogs")}
        </Link>
      }
    >
      {loading ? (
        <ChartSkeleton className="h-64" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShieldAlertIcon}
          title={t("charts.failedLogins.emptyTitle")}
          description={t("charts.failedLogins.emptyDescription")}
        />
      ) : (
        <figure>
          <ChartContainer
            config={failedConfig(t)}
            className="aspect-auto h-64 w-full"
            role="img"
            aria-label={t("dashboardCharts.failedLoginAttemptsBy")}
          >
            <LineChart data={rows} margin={{ left: 0, right: 16 }} accessibilityLayer>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 5" />
              <XAxis dataKey="hour" tickLine={false} axisLine={false} tickMargin={10} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={38} />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <ReferenceLine
                y={250}
                stroke="var(--warning)"
                strokeDasharray="4 4"
                label={{
                  value: t("charts.failedLogins.threshold"),
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "var(--muted-foreground)",
                }}
              />
              <Line
                type="monotone"
                dataKey="attempts"
                stroke="var(--color-attempts)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
            </LineChart>
          </ChartContainer>
          <table className="sr-only">
            <caption>{t("dashboardCharts.failedLoginAttemptsByHour")}</caption>
            <thead>
              <tr>
                <th>{t("dashboardCharts.hour")}</th>
                <th>{t("dashboardCharts.attempts")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.hour}>
                  <th>{row.hour}</th>
                  <td>{row.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      )}
    </DashboardPanel>
  );
}
