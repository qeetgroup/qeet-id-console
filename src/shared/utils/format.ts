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
