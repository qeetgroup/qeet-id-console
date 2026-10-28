// Settings › Security: the policy's durations and choices as the server takes them
// (internal/access/authorization/policy). Durations are Go duration strings ("720h", "30m").
import type { StepUpMethod } from "@/modules/organizations/api/security-policy";

/** A Go duration string in whole minutes ("720h", "1h30m0s", "5m"); 0 when it can't be read. */
export function durationMinutes(value: string): number {
  const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(value.trim());
  if (!parts || !value.trim()) return 0;
  const [, h = "0", m = "0", s = "0"] = parts;
  return Number(h) * 60 + Number(m) + Math.round(Number(s) / 60);
}

/** Minutes as the server writes them back: whole hours as "Nh", the rest as "Nm". */
export function durationString(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}m`;
}

/** The largest whole unit a duration is a number of, for its words ("30 days", "90 minutes"). */
export function durationParts(minutes: number): { unit: "days" | "hours" | "minutes"; n: number } {
  if (minutes > 0 && minutes % 1440 === 0) return { unit: "days", n: minutes / 1440 };
  if (minutes > 0 && minutes % 60 === 0) return { unit: "hours", n: minutes / 60 };
  return { unit: "minutes", n: minutes };
}

const H = 60;
const D = 24 * H;

/** A session's longest life: 1 hour to a year (config.SessionMaxAgeMin/Max). */
export const MAX_AGE_CHOICES = [
  H,
  8 * H,
  12 * H,
  D,
  7 * D,
  14 * D,
  30 * D,
  90 * D,
  180 * D,
  365 * D,
];

/** How long an unused session lasts: at least 15 minutes, and no longer than its longest life. */
export const IDLE_CHOICES = [15, 30, H, 4 * H, 8 * H, 12 * H, D, 7 * D, 30 * D];

/** How long a second step counts for sensitive actions: 1 to 60 minutes. */
export const WINDOW_CHOICES = [1, 5, 10, 15, 30, 60];

/** The choices, with the saved value kept among them when it isn't one, in order. */
export function withCurrent(choices: readonly number[], current: number): number[] {
  return [...new Set([...choices, current])].filter((n) => n > 0).sort((a, b) => a - b);
}

/** The factor types a second step can be met with, in the order the page lists them. */
export const STEP_UP_METHODS: StepUpMethod[] = ["webauthn", "totp", "recovery_code", "otp", "push"];

export const MFA_MODES = ["required", "admin_only", "optional"] as const;
export type MfaMode = (typeof MFA_MODES)[number];
export const isMfaMode = (value: string): value is MfaMode =>
  (MFA_MODES as readonly string[]).includes(value);

/** When a requirement's grace period ends: `days` after it was turned on; null when there's none. */
export function graceEnd(enforcedSince: string | null | undefined, days: number): Date | null {
  if (!enforcedSince || days <= 0) return null;
  return new Date(new Date(enforcedSince).getTime() + days * 86_400_000);
}
