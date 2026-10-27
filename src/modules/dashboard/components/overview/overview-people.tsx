// People and apps: people seen each week (area) against an average day (graphite line), and the
// applications people use as a dot plot on the organisation's scale.

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

import type { AnalyticsOverview } from "@/modules/dashboard/api/analytics";
import { type AppUse, axisScale } from "@/modules/dashboard/overview-model";
import {
  CHART,
  ChartTip,
  DotPlot,
  endLabel,
  Keys,
  LinkButton,
  num,
  Panel,
  ringDot,
} from "./overview-parts";

// ── Active people, by week ──────────────────────────────────────────────────────────────────

type WeekRow = { week: string; wau: number; dau: number };

/** People seen in the week (area) and on an average day (graphite line), full weeks only. */
export function ActivePeoplePanel({ overview }: { overview: AnalyticsOverview }) {
  const { t } = useTranslation("dashboard");
  // The current week has had only part of its days, so its count would read as a fall.
  const rows: WeekRow[] = overview.weekly_activity_8w.slice(0, -1);
  const last = rows.length - 1;
  const scale = axisScale(Math.max(...rows.map((r) => r.wau)));
  return (
    <Panel
      title={t("overview.activePeople.title")}
      note={t("overview.activePeople.note")}
      action={<LinkButton to="/analytics">{t("overview.activePeople.action")}</LinkButton>}
    >
      <Keys
        items={[
          { label: t("overview.activePeople.week"), color: CHART.data },
          { label: t("overview.activePeople.day"), color: CHART.muted },
        ]}
      />
      <div className="overview-chart">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart
            data={rows}
            margin={{ top: 10, right: 40, bottom: 0, left: -26 }}
            accessibilityLayer={false}
          >
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={{ stroke: CHART.grid }}
              tick={CHART.tick}
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
                <ChartTip<WeekRow>
                  rows={(r) => (
                    <>
                      <span className="overview-tip-row">
                        <b>{num(r.wau)}</b> {t("overview.activePeople.weekLower")}
                      </span>
                      <span className="overview-tip-row">
                        <b>{num(r.dau)}</b> {t("overview.activePeople.dayLower")}
                      </span>
                    </>
                  )}
                />
              }
            />
            <Area
              dataKey="wau"
              type="monotone"
              stroke={CHART.data}
              strokeWidth={2}
              fill={CHART.data}
              fillOpacity={0.1}
              dot={false}
              activeDot={ringDot(CHART.data)}
              isAnimationActive={false}
            >
              <LabelList dataKey="wau" content={endLabel(last, num)} />
            </Area>
            <Line
              dataKey="dau"
              type="monotone"
              stroke={CHART.muted}
              strokeWidth={2}
              dot={false}
              activeDot={ringDot(CHART.muted)}
              isAnimationActive={false}
            >
              <LabelList dataKey="dau" content={endLabel(last, num)} />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

// ── Applications people use ─────────────────────────────────────────────────────────────────

/** People signed in to each application (an active grant), as a dot plot on the organisation's scale. */
export function AppsPanel({
  used,
  unused,
  people,
}: {
  used: AppUse[];
  unused: { name: string }[];
  people: number;
}) {
  const { t } = useTranslation("dashboard");
  const shown = used.slice(0, 6);
  return (
    <Panel
      title={t("overview.apps.title")}
      note={t("overview.apps.note", { total: num(people) })}
      action={<LinkButton to="/auth/connections/oidc">{t("overview.apps.action")}</LinkButton>}
    >
      {shown.length ? (
        <DotPlot
          max={Math.max(people, shown[0]?.people ?? 1)}
          rows={shown.map((a) => ({
            id: a.client.id,
            label: a.client.name,
            hint: hostOf(a.client.redirect_uris[0]),
            value: a.people,
            text: num(a.people),
          }))}
        />
      ) : (
        <p className="overview-empty">{t("overview.apps.empty")}</p>
      )}
      {unused.length ? (
        <p className="overview-foot">
          {t("overview.apps.unused", {
            count: unused.length,
            names: unused
              .slice(0, 3)
              .map((c) => c.name)
              .join(", "),
          })}
        </p>
      ) : null}
    </Panel>
  );
}

function hostOf(uri?: string): string | undefined {
  if (!uri) return undefined;
  try {
    return new URL(uri).host;
  } catch {
    return undefined;
  }
}
