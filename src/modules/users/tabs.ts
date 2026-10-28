/**
 * The person's page views in display order; the route deep-links the open one as `?tab=`. How they
 * sign in (once Security and Identities) is Security; their IDs and raw record (once Developer)
 * are on Overview.
 */
export const USER360_TABS = ["overview", "access", "security", "sessions", "activity"] as const;

export type User360Tab = (typeof USER360_TABS)[number];

export function isUser360Tab(v: unknown): v is User360Tab {
  return typeof v === "string" && (USER360_TABS as readonly string[]).includes(v);
}

/** An old `?tab=` value, from before the views were merged, as the view that holds it now. */
export function user360Tab(v: unknown): User360Tab | undefined {
  if (v === "identities") return "security";
  return isUser360Tab(v) ? v : undefined;
}
