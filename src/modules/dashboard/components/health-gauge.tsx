import type { ReactNode } from "react";

import type { HealthState } from "../dashboard-insights";

export const healthColor: Record<HealthState, string> = {
  healthy: "var(--success)",
  attention: "var(--warning)",
  critical: "var(--destructive)",
};

export const healthText: Record<HealthState, string> = {
  healthy: "text-success",
  attention: "text-warning",
  critical: "text-destructive",
};

export function stateFromScore(score: number): HealthState {
  if (score >= 75) return "healthy";
  if (score >= 50) return "attention";
  return "critical";
}

/**
 * Renders a ring gauge coloured by the score's health state, with a centre readout. Not
 * `@qeetrix/ui`'s ProgressCircle: that has no colour prop, and the state colour is the point.
 */
export function HealthGauge({
  score,
  size = 116,
  stroke = 9,
  readout,
  caption = "/ 100",
  ariaLabel,
}: {
  score: number;
  size?: number;
  stroke?: number;
  readout?: ReactNode;
  caption?: ReactNode;
  ariaLabel: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const state = stateFromScore(score);
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      {/* -rotate-90 starts the arc at 12 o'clock instead of 3. */}
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
          opacity={0.6}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={healthColor[state]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-3xl font-semibold leading-none tabular-nums">
          {readout ?? score}
        </span>
        <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">{caption}</span>
      </div>
    </div>
  );
}
