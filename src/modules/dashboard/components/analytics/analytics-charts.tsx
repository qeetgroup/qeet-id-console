// The Analytics report's charts, from the Dashboard's parts (overview-parts.tsx): a day-by-day
// trend against the period before it, one axis, with a table twin; and the average day of the week.

import { Table, Toggle, ToggleGroup } from "@qeetrix/react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatLocale } from "@/i18n";
import { formatShortDate } from "@/modules/dashboard/api/analytics";
import { axisScale } from "@/modules/dashboard/overview-model";
import {
  CHART,
  endLabel,
  Keys,
  num,
  Panel,
  ringDot,
} from "@/modules/dashboard/components/overview/overview-parts";

/** The Dashboard's chart tooltip (its classes), titled from the point rather than the axis label. */
function Tip<T>({
  active,
  payload,
  title,
  rows,
}: {
  active?: boolean;
  payload?: readonly { payload?: T }[];
  title: (point: T) => ReactNode;
  rows: (point: T) => ReactNode;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="overview-tip">
      <strong>{title(point)}</strong>
      {rows(point)}
    </div>
  );
}

/** A date with its weekday, in UTC like the buckets: "Tue, 14 Oct". */
export function dayName(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(formatLocale(), {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export type TrendRow = {
  date: string;
  label: string;
  value: number;
  previousDate: string;
  previous: number;
};

export function trendRows(
  dates: readonly string[],
  values: readonly number[],
  previousDates: readonly string[],
  previous: readonly number[],
): TrendRow[] {
  return dates.map((date, i) => ({
    date,
    label: formatShortDate(date),
    value: values[i] ?? 0,
    previousDate: previousDates[i] ?? "",
    previous: previous[i] ?? 0,
  }));
}

/**
 * This period day by day against the period before it, on one axis: the range in its colour (an
 * area for sign-ins, a red line for failures), the period before in graphite, so the eye goes to now.
 */
export function TrendPanel({
  title,
  note,
  rows,
  failures,
  days,
}: {
  title: string;
  note: string;
  rows: TrendRow[];
  /** A count of failures: the red line; otherwise the data colour's area. */
  failures?: boolean;
  days: number;
}) {
  const { t } = useTranslation("dashboard");
  const [view, setView] = useState<string[]>(["chart"]);
  const color = failures ? CHART.bad : CHART.data;
  const unit = failures ? t("analyticsReport.failedLower") : t("analyticsReport.signInsLower");
  const last = rows.length - 1;
  const scale = axisScale(Math.max(...rows.flatMap((r) => [r.value, r.previous])));
  const keys = [
    { label: t("analyticsReport.thisPeriod"), color },
    { label: t("analyticsReport.before", { count: days }), color: CHART.muted },
  ];
  return (
    <Panel
      title={title}
      note={note}
      action={
        <ToggleGroup
          className="anl-view"
          aria-label={t("analyticsReport.view", { title })}
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
        <div className="anl-table">
          <Table
            label={title}
            rows={[...rows].reverse()}
            rowId={(r) => r.date}
            rowLabel={(r) => dayName(r.date)}
            columns={[
              {
                id: "day",
                header: t("analyticsReport.day"),
                cell: (r) => dayName(r.date),
                primary: true,
              },
              { id: "value", header: unit, numeric: true, cell: (r) => num(r.value) },
              {
                id: "previousDay",
                header: t("analyticsReport.dayBefore"),
                cell: (r) => dayName(r.previousDate),
              },
              { id: "previous", header: unit, numeric: true, cell: (r) => num(r.previous) },
            ]}
          />
        </div>
      ) : (
        <>
          <Keys items={keys} />
          <div className="overview-chart">
            <ResponsiveContainer width="100%" height={264}>
              <ComposedChart
                data={rows}
                margin={{ top: 12, right: 72, bottom: 0, left: -18 }}
                accessibilityLayer={false}
              >
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: CHART.grid }}
                  tick={CHART.tick}
                  interval="preserveStartEnd"
                  minTickGap={28}
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
                    <Tip<TrendRow>
                      title={(r) => dayName(r.date)}
                      rows={(r) => (
                        <>
                          <span className="overview-tip-row">
                            <span className="overview-key" style={{ background: color }} />
                            <b>{num(r.value)}</b>
                            {r.date === rows[last]?.date
                              ? t("analyticsReport.tipToday", { unit })
                              : unit}
                          </span>
                          <span className="overview-tip-row">
                            <span className="overview-key" style={{ background: CHART.muted }} />
                            <b>{num(r.previous)}</b>
                            {t("analyticsReport.tipOn", { day: dayName(r.previousDate) })}
                          </span>
                        </>
                      )}
                    />
                  }
                />
                <Line
                  dataKey="previous"
                  type="monotone"
                  stroke={CHART.muted}
                  strokeWidth={2}
                  dot={false}
                  activeDot={ringDot(CHART.muted)}
                  isAnimationActive={false}
                />
                {failures ? (
                  <Line
                    dataKey="value"
                    type="monotone"
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={ringDot(color)}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="value"
                      content={endLabel(last, (v) => t("analyticsReport.endToday", { n: num(v) }))}
                    />
                  </Line>
                ) : (
                  <Area
                    dataKey="value"
                    type="monotone"
                    stroke={color}
                    strokeWidth={2}
                    fill={color}
                    fillOpacity={0.1}
                    dot={false}
                    activeDot={ringDot(color)}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="value"
                      content={endLabel(last, (v) => t("analyticsReport.endToday", { n: num(v) }))}
                    />
                  </Area>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Panel>
  );
}

type WeekdayRow = { weekday: number; name: string; average: number; days: number };

/** The average day of the week over the range's full days: one series, the busiest labelled. */
export function WeekdayPanel({
  averages,
}: {
  averages: { weekday: number; average: number; days: number }[];
}) {
  const { t } = useTranslation("dashboard");
  const locale = formatLocale();
  // 5 to 11 Jan 2026 ran Monday to Sunday: name each weekday from that week.
  const name = (weekday: number, style: "short" | "long") =>
    new Date(Date.UTC(2026, 0, 4 + (weekday === 0 ? 7 : weekday))).toLocaleDateString(locale, {
      weekday: style,
      timeZone: "UTC",
    });
  const rows: WeekdayRow[] = averages.map((a) => ({ ...a, name: name(a.weekday, "short") }));
  const busiest = rows.reduce<WeekdayRow | undefined>(
    (best, r) => (!best || r.average > best.average ? r : best),
    undefined,
  );
  const scale = axisScale(Math.max(...rows.map((r) => r.average)));
  const one = (v: number) => v.toLocaleString(locale, { maximumFractionDigits: 1 });
  const full = rows.reduce((n, r) => n + r.days, 0);
  return (
    <Panel
      title={t("analyticsReport.weekday.title")}
      note={t("analyticsReport.weekday.note", { count: full, n: num(full) })}
    >
      <div className="overview-chart">
        <ResponsiveContainer width="100%" height={264}>
          <BarChart
            data={rows}
            margin={{ top: 20, right: 8, bottom: 0, left: -18 }}
            accessibilityLayer={false}
            barCategoryGap="28%"
          >
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={{ stroke: CHART.grid }}
              tick={CHART.tick}
              interval={0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={CHART.tick}
              width={48}
              domain={[0, scale.top]}
              ticks={scale.ticks}
            />
            <Tooltip
              cursor={{ fill: "var(--qx-color-bg-neutral-subtle)" }}
              content={
                <Tip<WeekdayRow>
                  title={(r) => name(r.weekday, "long")}
                  rows={(r) => (
                    <span className="overview-tip-row">
                      <span className="overview-key" style={{ background: CHART.data }} />
                      <b>{one(r.average)}</b>
                      {t("analyticsReport.weekday.tip", { count: r.days, n: num(r.days) })}
                    </span>
                  )}
                />
              }
            />
            <Bar dataKey="average" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.weekday} fill={CHART.data} />
              ))}
              <LabelList
                dataKey="average"
                content={(p: {
                  index?: number;
                  x?: number | string;
                  y?: number | string;
                  width?: number | string;
                  value?: unknown;
                }) =>
                  busiest && rows[p.index ?? -1] === busiest ? (
                    <text
                      x={Number(p.x) + Number(p.width) / 2}
                      y={Number(p.y) - 6}
                      textAnchor="middle"
                      className="overview-chart-label"
                    >
                      {one(Number(p.value))}
                    </text>
                  ) : null
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
