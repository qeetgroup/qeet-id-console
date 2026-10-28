// Sign-ins over 14 days against the failed ones (area and line on one axis, with a table twin),
// and how people sign in: each method's share and its own 14-day line on one shared scale.

import { Table, Toggle, ToggleGroup } from "@qeetrix/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import i18n from "@/i18n";
import { type AnalyticsOverview, formatShortDate } from "@/modules/dashboard/api/analytics";
import { loginMethodLabel } from "@/modules/dashboard/dashboard-model";
import { axisScale } from "@/modules/dashboard/overview-model";
import {
  CHART,
  ChartTip,
  endLabel,
  Keys,
  LinkButton,
  num,
  Panel,
  pct,
  ringDot,
  Sparkline,
} from "./overview-parts";

// ── Sign-ins, last 14 days ──────────────────────────────────────────────────────────────────

type DayRow = {
  date: string;
  day: string;
  total: number;
  failed: number;
  methods: { label: string; value: number }[];
};

const METHOD_KEYS = [
  "saml",
  "password",
  "social",
  "magic_link",
  "passkey",
  "oidc",
  "ldap",
] as const;

/** Sign-ins against failed sign-ins: same unit, one axis — the area is the volume, the red line the failures. */
export function SignInsPanel({ overview }: { overview: AnalyticsOverview }) {
  const { t } = useTranslation("dashboard");
  const [view, setView] = useState<string[]>(["chart"]);
  const failedByDate = new Map(overview.failed_trend_14d.map((p) => [p.date, p.value]));
  const activityByDate = new Map(overview.login_activity_14d.map((p) => [p.date, p]));
  const rows: DayRow[] = overview.login_trend_14d.map((p) => {
    const a = activityByDate.get(p.date);
    return {
      date: p.date,
      day: formatShortDate(p.date),
      total: p.value,
      failed: failedByDate.get(p.date) ?? 0,
      methods: a
        ? METHOD_KEYS.filter((m) => (a[m] ?? 0) > 0).map((m) => ({
            label: methodName(m),
            value: a[m] ?? 0,
          }))
        : [],
    };
  });
  const last = rows.length - 1;
  const scale = axisScale(Math.max(...rows.map((r) => r.total)));
  // Two series that end close together label above and below their last points, not on top.
  const lastRow = rows[last];
  const close = lastRow ? Math.abs(lastRow.total - lastRow.failed) < scale.top * 0.12 : false;
  return (
    <Panel
      title={t("overview.signIns.title")}
      note={t("overview.signIns.note")}
      action={
        <ToggleGroup
          aria-label={t("overview.signIns.view")}
          size="sm"
          value={view}
          onValueChange={(v) => v.length && setView(v as string[])}
        >
          <Toggle value="chart">{t("overview.chart")}</Toggle>
          <Toggle value="table">{t("overview.table")}</Toggle>
        </ToggleGroup>
      }
    >
      {view[0] === "table" ? (
        <Table
          label={t("overview.signIns.title")}
          rows={rows}
          rowId={(r) => r.date}
          rowLabel={(r) => r.day}
          columns={[
            { id: "day", header: t("overview.signIns.day"), cell: (r) => r.day, primary: true },
            {
              id: "total",
              header: t("overview.signIns.signIns"),
              numeric: true,
              cell: (r) => num(r.total),
            },
            {
              id: "failed",
              header: t("overview.signIns.failed"),
              numeric: true,
              cell: (r) => num(r.failed),
            },
          ]}
        />
      ) : (
        <>
          <Keys
            items={[
              { label: t("overview.signIns.signIns"), color: CHART.data },
              { label: t("overview.signIns.failed"), color: CHART.bad },
            ]}
          />
          <div className="overview-chart">
            <ResponsiveContainer width="100%" height={272}>
              <ComposedChart
                data={rows}
                margin={{ top: 12, right: 72, bottom: 0, left: -18 }}
                accessibilityLayer={false}
              >
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={{ stroke: CHART.grid }}
                  tick={CHART.tick}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={CHART.tick}
                  allowDecimals={false}
                  width={48}
                  domain={[0, scale.top]}
                  ticks={scale.ticks}
                />
                <Tooltip
                  cursor={CHART.crosshair}
                  content={
                    <ChartTip<DayRow>
                      rows={(r) => (
                        <>
                          <span className="overview-tip-row">
                            <span className="overview-key" style={{ background: CHART.data }} />
                            <b>{num(r.total)}</b> {t("overview.signIns.signInsLower")}
                          </span>
                          {r.methods.length ? (
                            <span className="overview-tip-sub">
                              {r.methods.map((m) => `${m.label} ${num(m.value)}`).join(" · ")}
                            </span>
                          ) : null}
                          <span className="overview-tip-row">
                            <span className="overview-key" style={{ background: CHART.bad }} />
                            <b>{num(r.failed)}</b> {t("overview.signIns.failedLower")}
                          </span>
                        </>
                      )}
                    />
                  }
                />
                <Area
                  dataKey="total"
                  type="monotone"
                  stroke={CHART.data}
                  strokeWidth={2}
                  fill={CHART.data}
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={ringDot(CHART.data)}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="total"
                    content={endLabel(
                      last,
                      (v) => t("overview.signIns.endToday", { n: num(v) }),
                      close ? -10 : 4,
                    )}
                  />
                </Area>
                <Line
                  dataKey="failed"
                  type="monotone"
                  stroke={CHART.bad}
                  strokeWidth={2}
                  dot={false}
                  activeDot={ringDot(CHART.bad)}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="failed"
                    content={endLabel(last, (v) => t("overview.signIns.endFailed", { n: num(v) }))}
                  />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Panel>
  );
}

/** A sign-in method's name: SAML reads as single sign-on here; the rest as the catalogue names them. */
function methodName(method: string): string {
  if (method === "saml") return i18n.t("dashboard:overview.methods.sso");
  if (method === "oidc") return i18n.t("dashboard:overview.methods.oidc");
  return loginMethodLabel(method);
}

// ── How people sign in ──────────────────────────────────────────────────────────────────────

/** Each method's share of the last 30 days, and its own 14-day line on one shared scale. */
export function SignInMethodsPanel({
  overview,
  hints,
}: {
  overview: AnalyticsOverview;
  hints: Partial<Record<string, string>>;
}) {
  const { t } = useTranslation("dashboard");
  const series = (m: (typeof METHOD_KEYS)[number]) =>
    overview.login_activity_14d.map((d) => d[m] ?? 0);
  const rows = [...overview.login_methods_mix]
    .filter((m) => m.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((m) => ({ ...m, key: m.method.toLowerCase() as (typeof METHOD_KEYS)[number] }));
  const max = Math.max(
    1,
    ...rows.flatMap((r) => (METHOD_KEYS.includes(r.key) ? series(r.key) : [])),
  );
  return (
    <Panel
      title={t("overview.methods.title")}
      note={t("overview.methods.note")}
      action={
        <LinkButton to="/auth/login-methods/password">{t("overview.methods.action")}</LinkButton>
      }
    >
      {rows.length ? (
        <table className="overview-methods">
          <thead>
            <tr>
              <th scope="col">{t("overview.methods.method")}</th>
              <th scope="col">{t("overview.methods.days")}</th>
              <th scope="col" className="is-num">
                {t("overview.methods.share")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.method}>
                <th scope="row">
                  {methodName(r.key)}
                  {r.key === "passkey" ? (
                    <small>{t("overview.methods.passkeyHint")}</small>
                  ) : hints[r.key] ? (
                    <small>{hints[r.key]}</small>
                  ) : null}
                </th>
                <td>
                  {METHOD_KEYS.includes(r.key) ? (
                    <Sparkline values={series(r.key)} max={max} width={104} height={28} />
                  ) : null}
                </td>
                <td className="is-num">{pct(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="overview-empty">{t("overview.methods.empty")}</p>
      )}
    </Panel>
  );
}
