import { formatLocale } from "@/i18n";

// The formatters return "—" for empty input and the raw string when it can't be formatted.

/** Medium date, e.g. "Aug 16, 2026". */
export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(formatLocale(), { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Converts a `datetime-local` value ("2026-11-01T10:30") to the RFC 3339 UTC instant of that
 * moment in the browser's time zone, or null when the value is empty or unreadable.
 */
export function localDateTimeToInstant(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Medium date + short time, e.g. "Aug 16, 2026, 3:45 PM". */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(formatLocale(), {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
