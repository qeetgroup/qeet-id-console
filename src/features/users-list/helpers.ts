// Small shared helpers for the Users admin table.

/** "Mareedu Saibabu" → "MS"; "qeetgroup@gmail.com" → "QG"; robust to single words. */
export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

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
