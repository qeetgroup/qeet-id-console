import { cn } from "@qeetrix/ui";
import type { ReactNode } from "react";

const TONE_CLASSES = {
  success: "text-success",
  warning: "text-warning",
  primary: "text-primary",
  danger: "text-destructive",
} as const;

export type PostureRingTone = keyof typeof TONE_CLASSES;

/**
 * Renders a donut gauge with any centre content. It owns its SVG because the kit's
 * ProgressCircle hard-codes `text-primary`, and these rings are coloured by what they report.
 */
export function PostureRing({
  value,
  tone = "primary",
  size = 104,
  strokeWidth = 10,
  ariaLabel,
  children,
}: {
  value: number; // 0–100, clamped
  tone?: PostureRingTone;
  size?: number;
  strokeWidth?: number;
  ariaLabel: string;
  children: ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (clamped / 100) * circumference}
          className={cn("transition-[stroke-dashoffset] duration-500", TONE_CLASSES[tone])}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">{children}</div>
    </div>
  );
}
