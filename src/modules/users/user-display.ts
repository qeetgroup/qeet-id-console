const ROLE_PRIORITY = ["owner", "admin", "developer", "member", "viewer"];

/** Returns the highest-ranked role by ROLE_PRIORITY; unknown roles rank last. */
export function primaryRole(roles?: string[] | null): string | null {
  if (!roles || roles.length === 0) return null;
  const sorted = [...roles].sort((a, b) => {
    const ai = ROLE_PRIORITY.indexOf(a.toLowerCase());
    const bi = ROLE_PRIORITY.indexOf(b.toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  // roles is non-empty here, so the fallback is the same null the guard above returns.
  return sorted[0] ?? null;
}

/** Returns the first `head` characters of an id and an ellipsis: "6607bc8c-e…". */
export function shortId(id: string, head = 10): string {
  return id.length > head ? `${id.slice(0, head)}…` : id;
}

/** Returns an id's head and tail around an ellipsis: "6607bc8c…bfc61". */
export function truncateId(id: string, head = 8, tail = 5): string {
  if (!id) return "";
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}
