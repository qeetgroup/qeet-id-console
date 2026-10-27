// Sign-in and security: the last 24 hours of failed sign-ins as a spike line with its bursts marked,
// and two-step coverage as a gauge against its target, with who has which factor.

import { useTranslation } from "react-i18next";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import i18n, { formatLocale } from "@/i18n";
import type { TrustedDeviceSummary } from "@/modules/authentication";
import type { AnalyticsOverview } from "@/modules/dashboard/api/analytics";
import { mfaMethodId, mfaMethodLabel } from "@/modules/dashboard/dashboard-model";
import {
  axisScale,
  burstHours,
  localHour,
  MFA_TARGET_PCT,
} from "@/modules/dashboard/overview-model";
import type { UserStats } from "@/modules/users";
import {
  CHART,
  ChartTip,
  Gauge,
  LinkButton,
  num,
  Panel,
  ringDot,
  SplitBar,
} from "./overview-parts";

// ── Failed sign-ins, last 24 hours ──────────────────────────────────────────────────────────

type HourRow = { hour: string; attempts: number; burst: boolean };

/** The last 24 hours as a spike line, in the person's own time, with the bursts marked and labelled. */
export function FailedHoursPanel({ overview }: { overview: AnalyticsOverview }) {
  const { t } = useTranslation("dashboard");
  const hours = overview.failed_logins_hourly_24h;
  const bursts = burstHours(hours);
  const rows: HourRow[] = hours.map((h, i) => ({
    hour: localHour(h.hour, formatLocale()),
    attempts: h.attempts,
    burst: bursts.has(i),
  }));
  const total = hours.reduce((n, h) => n + h.attempts, 0);
  const scale = axisScale(Math.max(...rows.map((r) => r.attempts)));
  const note = !total
    ? t("overview.failedHours.noneNote")
    : bursts.size
      ? t("overview.failedHours.burstsNote", { count: bursts.size })
      : t("overview.failedHours.note");
  const ticks = rows.filter((_, i) => i % 6 === 0).map((r) => r.hour);
  const BurstDot = (p: { cx?: number; cy?: number; index?: number; payload?: HourRow }) =>
    p.payload?.burst ? (
      <g key={p.index}>
        <circle
          cx={p.cx}
          cy={p.cy}
          r={4.5}
          fill={CHART.bad}
          stroke={CHART.surface}
          strokeWidth={2}
        />
        <text x={Number(p.cx) + 8} y={Number(p.cy) + 4} className="overview-chart-label">
          {t("overview.failedHours.burst", { n: num(p.payload.attempts), time: p.payload.hour })}
        </text>
      </g>
    ) : (
      <g key={p.index} />
    );
  return (
    <Panel
      title={t("overview.failedHours.title")}
      note={note}
      action={<LinkButton to="/activity">{t("overview.failedHours.action")}</LinkButton>}
    >
      <div className="overview-chart">
        <ResponsiveContainer width="100%" height={188}>
          <ComposedChart
            data={rows}
            margin={{ top: 16, right: 88, bottom: 0, left: -26 }}
            accessibilityLayer={false}
          >
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={{ stroke: CHART.grid }}
              tick={CHART.tick}
              ticks={ticks}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={CHART.tick}
              allowDecimals={false}
              width={44}
              domain={[0, scale.top]}
              ticks={scale.ticks}
            />
            <Tooltip
              cursor={CHART.crosshair}
              content={
                <ChartTip<HourRow>
                  rows={(r) => (
                    <span className="overview-tip-row">
                      <b>{num(r.attempts)}</b> {t("overview.failedHours.tip")}
                    </span>
                  )}
                />
              }
            />
            <Area
              dataKey="attempts"
              type="linear"
              stroke={CHART.bad}
              strokeWidth={2}
              fill={CHART.bad}
              fillOpacity={0.08}
              dot={BurstDot}
              activeDot={ringDot(CHART.bad)}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

// ── Two-step verification ───────────────────────────────────────────────────────────────────

/** Coverage against the target as a gauge; covered vs not as one split bar; who has which factor. */
export function TwoStepPanel({
  stats,
  overview,
  devices,
}: {
  stats: UserStats;
  overview?: AnalyticsOverview;
  devices?: TrustedDeviceSummary;
}) {
  const { t } = useTranslation("dashboard");
  const share = stats.total ? stats.mfa_enabled / stats.total : 0;
  const factors = (overview?.mfa_methods_adoption ?? []).filter((m) => m.users > 0);
  return (
    <Panel
      title={t("overview.twoStep.title")}
      note={t("overview.twoStep.note", { target: MFA_TARGET_PCT })}
      action={
        stats.mfa_missing > 0 ? (
          <LinkButton to="/settings/organization/security-policy">
            {t("overview.twoStep.action")}
          </LinkButton>
        ) : undefined
      }
    >
      <Gauge
        value={share}
        target={MFA_TARGET_PCT / 100}
        label={t("overview.twoStep.gauge", {
          pct: Math.round(share * 100),
          target: MFA_TARGET_PCT,
        })}
        valueText={`${Math.round(share * 100)}%`}
        subText={t("overview.twoStep.ofPeople", { have: stats.mfa_enabled, total: stats.total })}
        targetText={t("overview.twoStep.target", { pct: MFA_TARGET_PCT })}
      />
      <SplitBar
        label={t("overview.twoStep.split", { have: stats.mfa_enabled, missing: stats.mfa_missing })}
        parts={[
          { value: stats.mfa_enabled, color: CHART.data },
          { value: stats.mfa_missing, color: CHART.warn },
        ]}
      />
      <dl className="overview-facts">
        <div>
          <dt>
            <span className="overview-swatch" style={{ background: CHART.data }} />
            {t("overview.twoStep.have")}
          </dt>
          <dd>{num(stats.mfa_enabled)}</dd>
        </div>
        <div>
          <dt>
            <span className="overview-swatch" style={{ background: CHART.warn }} />
            {t("overview.twoStep.none")}
          </dt>
          <dd>{num(stats.mfa_missing)}</dd>
        </div>
        {factors.length ? (
          <div>
            <dt>{factors.map((f) => factorName(f.method)).join(" · ")}</dt>
            <dd>{factors.map((f) => num(f.users)).join(" · ")}</dd>
          </div>
        ) : null}
        {devices && devices.devices > 0 ? (
          <div>
            <dt>{t("overview.twoStep.devices")}</dt>
            <dd>
              {t("overview.twoStep.devicesValue", {
                count: devices.devices,
                people: devices.users,
              })}
            </dd>
          </div>
        ) : null}
      </dl>
    </Panel>
  );
}

/** A second factor's name; TOTP reads as the authenticator app it is. */
function factorName(method: string): string {
  return mfaMethodId(method) === "totp"
    ? i18n.t("dashboard:overview.twoStep.authenticator")
    : mfaMethodLabel(method);
}
