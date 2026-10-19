// Locale-aware date/time formatting. Domain-independent — the single source for
// rendering ISO timestamps across the console. Returns "—" for empty input and
// falls back to the raw string if parsing fails.

/** Medium date, e.g. "Aug 16, 2026". */
export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * A `datetime-local` input value ("2026-11-01T10:30", no seconds or offset) as
 * the RFC 3339 UTC instant of that moment in the browser's time zone, or null
 * when the value is empty or unreadable.
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
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}
