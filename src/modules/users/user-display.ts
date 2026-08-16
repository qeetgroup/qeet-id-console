// Small shared helpers for the Users admin table.

/** "Mareedu Saibabu" → "MS"; "qeetgroup@gmail.com" → "QG"; robust to single words. */

const ROLE_PRIORITY = ["owner", "admin", "developer", "member", "viewer"];

/** Pick the most privileged-looking role to headline the Access column. */
export function primaryRole(roles?: string[] | null): string | null {
  if (!roles || roles.length === 0) return null;
  const sorted = [...roles].sort((a, b) => {
    const ai = ROLE_PRIORITY.indexOf(a.toLowerCase());
    const bi = ROLE_PRIORITY.indexOf(b.toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return sorted[0];
}

/** "6607bc8c-e084-…" style short id for dense table cells. */
export function shortId(id: string, head = 10): string {
  return id.length > head ? `${id.slice(0, head)}…` : id;
}

/** "6607bc8c-e084-…-4d285f1bfc61" → "6607bc8c…bfc61" (keeps head + tail). */
export function truncateId(id: string, head = 8, tail = 5): string {
  if (!id) return "";
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}
