// Secrets: when each was last changed, and what about one needs a look. Pure; the page words them.
import type { Secret } from "@/modules/developer/api/secrets";
import { DAY } from "@/modules/developer/machine-model";

/** A value unchanged this long is worth a look. */
const STALE_DAYS = 365;
export const CHANGED = ["month", "quarter", "year", "older", "never"] as const;
export type Changed = (typeof CHANGED)[number];
export type SecretLook = "stale" | "short";
export type SecretFilters = { q?: string; scope?: string; changed?: Changed; look?: SecretLook };

export const NO_SCOPE = "-";
export const changedOf = (s: Secret, now: number): Changed => {
  if (s.updated_at === s.created_at) return "never";
  const age = now - Date.parse(s.updated_at);
  return age < 30 * DAY ? "month" : age < 90 * DAY ? "quarter" : age < 365 * DAY ? "year" : "older";
};
export const looksOf = (s: Secret, now: number): SecretLook[] => [
  ...(now - Date.parse(s.updated_at) > STALE_DAYS * DAY ? (["stale"] as const) : []),
  ...(!s.last4 ? (["short"] as const) : []),
];
export const CHANGED_COLOR: Record<Changed, string> = {
  month: "var(--ppl-today)",
  quarter: "var(--ppl-week)",
  year: "var(--ppl-month)",
  older: "var(--ppl-older)",
  never: "var(--ppl-never)",
};
