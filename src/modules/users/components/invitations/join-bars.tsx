// A small chart the library doesn't have yet (QTRX-13): how many people joined on each day after
// their invitation, from day 0 to the link's expiry, which is marked.

import { LINK_DAYS } from "@/modules/users/invitations-model";

export function JoinBars({
  values,
  label,
  end,
}: {
  values: readonly number[];
  label: string;
  /** The last tick: the link's length, in words ("14 days"). */
  end: string;
}) {
  const slots = Array.from(
    { length: LINK_DAYS },
    (_, d) => values.filter((v) => Math.floor(v) === d).length,
  );
  const top = Math.max(...slots, 1);
  const width = 168;
  const height = 40;
  const bar = 8;
  const step = (width - bar) / (LINK_DAYS - 1);
  const latest = Math.min(LINK_DAYS - 1, Math.floor(Math.max(...values, 0)));
  return (
    <svg
      className="sub-bars"
      viewBox={`0 0 ${width} ${height + 14}`}
      width={width}
      height={height + 14}
      role="img"
      aria-label={label}
    >
      <line x1={0} x2={width} y1={height} y2={height} className="sub-bars-axis" />
      {slots.map((count, d) =>
        count ? (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: one bar per day, in day order
            key={d}
            x={d * step}
            y={height - (count / top) * (height - 4)}
            width={bar}
            height={(count / top) * (height - 4)}
            rx={2}
            className="sub-bars-bar"
          />
        ) : null,
      )}
      <line x1={width - 1} x2={width - 1} y1={4} y2={height} className="sub-bars-expiry" />
      <text x={0} y={height + 12} className="sub-bars-tick">
        0
      </text>
      {latest > 1 && latest < LINK_DAYS - 3 ? (
        <text
          x={latest * step + bar / 2}
          y={height + 12}
          textAnchor="middle"
          className="sub-bars-tick"
        >
          {latest}
        </text>
      ) : null}
      <text x={width} y={height + 12} textAnchor="end" className="sub-bars-tick">
        {end}
      </text>
    </svg>
  );
}
