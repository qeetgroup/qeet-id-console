/**
 * Dial codes for the phone field on the user forms.
 *
 * Deliberately a short, curated list rather than all ~250 ISO countries: the
 * console's own operators are the audience, the field is optional, and a full
 * list needs search to be usable. Add entries as real demand appears.
 *
 * Entries carry the ISO code only — the picker shows "US +1", not the country
 * name, which keeps the trigger narrow next to the number input.
 *
 * `flag` is the regional-indicator emoji pair, so no icon assets are needed.
 */
export type DialCode = {
  /** ISO 3166-1 alpha-2 — shown in the picker instead of the full country name. */
  code: string;
  dial: string;
  flag: string;
};

export const DIAL_CODES: readonly DialCode[] = [
  { code: "US", dial: "+1", flag: "🇺🇸" },
  { code: "CA", dial: "+1", flag: "🇨🇦" },
  { code: "IN", dial: "+91", flag: "🇮🇳" },
  { code: "GB", dial: "+44", flag: "🇬🇧" },
  { code: "AU", dial: "+61", flag: "🇦🇺" },
  { code: "DE", dial: "+49", flag: "🇩🇪" },
  { code: "FR", dial: "+33", flag: "🇫🇷" },
  { code: "ES", dial: "+34", flag: "🇪🇸" },
  { code: "PT", dial: "+351", flag: "🇵🇹" },
  { code: "BR", dial: "+55", flag: "🇧🇷" },
  { code: "JP", dial: "+81", flag: "🇯🇵" },
  { code: "CN", dial: "+86", flag: "🇨🇳" },
  { code: "SG", dial: "+65", flag: "🇸🇬" },
  { code: "AE", dial: "+971", flag: "🇦🇪" },
  { code: "ZA", dial: "+27", flag: "🇿🇦" },
] as const;

export const DEFAULT_DIAL_COUNTRY = "US";

/** Join a dial code and a typed national number into one E.164 string. */
export function toE164(dial: string, national: string): string | undefined {
  const digits = national.replace(/\D/g, "");
  if (!digits) return undefined;
  return `${dial}${digits}`;
}
