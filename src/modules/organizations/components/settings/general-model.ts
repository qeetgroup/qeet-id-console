// The organisation's profile, as PATCH /v1/tenants/{id} takes it: three free-text keys in its
// `metadata`, which the organisation's page shows under its name. The server replaces the whole
// object, so a change keeps every other key it holds.

export const PROFILE_KEYS = ["industry", "headquarters", "website"] as const;
export type ProfileKey = (typeof PROFILE_KEYS)[number];

type Metadata = Record<string, unknown> | null | undefined;

/** A profile value as text: empty when it isn't set or isn't a string. */
export function metaText(metadata: Metadata, key: ProfileKey): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

/** The whole metadata with one profile key set, or removed when `value` is empty. */
export function withProfile(
  metadata: Metadata,
  key: ProfileKey,
  value: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(metadata ?? {}) };
  if (value) next[key] = value;
  else delete next[key];
  return next;
}

/**
 * A website as it's saved: an http(s) address, `https://` added to a bare host ("qeet.in"), or ""
 * to clear it. null when it isn't a web address.
 */
export function checkWebsite(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".") || url.username || url.password) return null;
    return withScheme;
  } catch {
    return null;
  }
}
