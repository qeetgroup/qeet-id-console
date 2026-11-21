// The Overview's building blocks, composed from tokens on the Qeetrix rules: ruled panels in a
// shared sheet, and three small charts the library doesn't have (Gauge, DotPlot, and SplitBar,
// whose ordered parts need sequential tones that Qeetrix's ShareBar doesn't take yet).

import { LinkButton } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";

import { formatLocale } from "@/i18n";

/** Chart colours: one data colour, graphite for the de-emphasised series, status only for meaning. */
export const CHART = {
  data: "var(--qx-color-dataviz-categorical-1)",
  muted: "var(--qx-color-dataviz-reference)",
  bad: "var(--qx-color-dataviz-negative)",
  warn: "var(--qx-color-dataviz-warning)",
  grid: "var(--qx-color-dataviz-grid)",
  surface: "var(--qx-color-surface-raised)",
  tick: { fill: "var(--qx-color-text-subtle)", fontSize: 12 },
  crosshair: { stroke: "var(--qx-color-border-strong)", strokeWidth: 1 },
} as const;

/** A data point's active marker: a 4px dot with a 2px ring in the surface colour. */
export const ringDot = (fill: string) => ({ r: 4, fill, stroke: CHART.surface, strokeWidth: 2 });

/** A ruled panel inside a row's sheet: a titled header (a rule below it), then the body. */
export function Panel({
  title,
  note,
  action,
  children,
  flush,
}: {
  title: ReactNode;
  note?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** The body runs edge to edge (a list of rows). */
  flush?: boolean;
}) {
  return (
    <section className="overview-panel">
      <header className="overview-panel-head">
        <div>
          <h2 className="overview-panel-title">{title}</h2>
          {note ? <p className="overview-panel-note">{note}</p> : null}
        </div>
        {action}
      </header>
      <div className={flush ? "overview-panel-body is-flush" : "overview-panel-body"}>
        {children}
      </div>
    </section>
  );
}

/** A row of panels in one ruled sheet, under an optional label.caps group label. */
export function Group({
  label,
  columns,
  children,
}: {
  label?: string;
  columns: string;
  children: ReactNode;
}) {
  return (
    <div className="overview-group">
      {label ? <h2 className="overview-group-label">{label}</h2> : null}
      <div className="overview-sheet" style={{ "--overview-columns": columns } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}

/** The legend for two or more series: a short line in the series colour beside its name. */
export function Keys({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="overview-keys" aria-hidden="true">
      {items.map((k) => (
        <li key={k.label}>
          <span className="overview-key" style={{ background: k.color }} />
          {k.label}
        </li>
      ))}
    </ul>
  );
}

/** A chart tooltip: its title, then the rows the chart passes for the point under the pointer. */
export function ChartTip<T>({
  active,
  payload,
  label,
  rows,
}: {
  active?: boolean;
  payload?: readonly { payload?: T }[];
  label?: ReactNode;
  rows: (point: T) => ReactNode;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="overview-tip">
      <strong>{label}</strong>
      {rows(point)}
    </div>
  );
}

/** A semicircle gauge: a share against its target, with square ends like every Qeetrix mark. */
export function Gauge({
  value,
  target,
  label,
  valueText,
  subText,
  targetText,
}: {
  value: number; // 0–1
  target: number; // 0–1
  label: string;
  valueText: string;
  subText: string;
  targetText: string;
}) {
  const W = 232;
  const H = 128;
  const cx = W / 2;
  const cy = 116;
  const r = 92;
  const stroke = 16;
  const pt = (f: number, radius = r) => {
    const a = Math.PI * (1 - Math.min(1, Math.max(0, f)));
    return [cx + radius * Math.cos(a), cy - radius * Math.sin(a)] as const;
  };
  const arc = (f: number) => {
    const [x0, y0] = pt(0);
    const [x1, y1] = pt(f);
    return `M${x0},${y0} A${r},${r} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
  };
  const [tx0, ty0] = pt(target, r - stroke / 2 - 5);
  const [tx1, ty1] = pt(target, r + stroke / 2 + 5);
  const [lx, ly] = pt(target, r + stroke / 2 + 18);
  return (
    <figure className="overview-gauge" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
        <path d={arc(1)} fill="none" stroke="var(--overview-gauge-track)" strokeWidth={stroke} />
        {value > 0 ? (
          <path d={arc(value)} fill="none" stroke={CHART.warn} strokeWidth={stroke} />
        ) : null}
        <line
          x1={tx0}
          y1={ty0}
          x2={tx1}
          y2={ty1}
          stroke="var(--qx-color-text-default)"
          strokeWidth={2}
        />
        <text x={lx + 4} y={ly} className="overview-gauge-note">
          {targetText}
        </text>
        <text x={cx} y={cy - 22} textAnchor="middle" className="overview-gauge-value">
          {valueText}
        </text>
        <text x={cx} y={cy - 2} textAnchor="middle" className="overview-gauge-note">
          {subText}
        </text>
      </svg>
    </figure>
  );
}

/** A dot plot: a thin stem from zero, a ringed dot at the value, the value just after it. */
export function DotPlot({
  rows,
  max,
}: {
  rows: { id: string; label: ReactNode; hint?: ReactNode; value: number; text: string }[];
  max: number;
}) {
  return (
    <ul className="overview-dots">
      {rows.map((r) => {
        const at = `${(Math.min(r.value, max) / Math.max(max, 1)) * 100}%`;
        return (
          <li key={r.id}>
            <span className="overview-dots-label">
              {r.label}
              {r.hint ? <small>{r.hint}</small> : null}
            </span>
            <span className="overview-dots-plot">
              <span className="overview-dots-stem" style={{ inlineSize: at }} />
              <span className="overview-dots-dot" style={{ insetInlineStart: at }} />
              <span className="overview-dots-value" style={{ insetInlineStart: at }}>
                {r.text}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** One bar split into parts, a 2px surface gap between them; the legend beside it names the parts. */
export function SplitBar({
  parts,
  label,
}: {
  parts: { value: number; color: string }[];
  label: string;
}) {
  return (
    <div className="overview-split" role="img" aria-label={label}>
      {parts
        .filter((p) => p.value > 0)
        .map((p) => (
          <span key={p.color} style={{ flexGrow: p.value, background: p.color }} />
        ))}
    </div>
  );
}

/** Counts and shares, in the person's locale. */
export const num = (n: number) => n.toLocaleString(formatLocale());
export const pct = (n: number) =>
  `${n.toLocaleString(formatLocale(), { maximumFractionDigits: 1 })}%`;

/** A direct label on a series' last point; text tokens, never the series colour. */
export function endLabel(lastIndex: number, text: (value: number) => string, dy = 4) {
  return function renderEndLabel(p: {
    index?: number;
    x?: number | string;
    y?: number | string;
    value?: unknown;
  }) {
    if (p.index !== lastIndex) return null;
    return (
      <text x={Number(p.x) + 8} y={Number(p.y) + dy} className="overview-chart-label">
        {text(Number(p.value))}
      </text>
    );
  };
}

/** A panel's way into its list: a small ghost LinkButton, announced as a link. */
export function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <LinkButton variant="ghost" size="sm" render={<Link to={to as never} />}>
      {children}
    </LinkButton>
  );
}
