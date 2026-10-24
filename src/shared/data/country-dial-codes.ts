/**
 * A dial code for the phone field. The list is short on purpose: a full one needs search to be
 * usable. The picker shows the ISO code ("US +1") to stay narrow, and `flag` is the
 * regional-indicator emoji pair, so no icon assets are needed.
 */
export type DialCode = {
  code: string; // ISO 3166-1 alpha-2, shown in place of the country name
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

/** Joins a dial code and a typed national number into one E.164 string; undefined if no digits. */
export function toE164(dial: string, national: string): string | undefined {
  const digits = national.replace(/\D/g, "");
  if (!digits) return undefined;
  return `${dial}${digits}`;
}
