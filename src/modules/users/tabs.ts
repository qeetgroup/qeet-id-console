// The User 360 workspace tabs, in display order. The route deep-links the active
// tab via a `?tab=` search param so any view is shareable.

export const USER360_TABS = [
  "overview",
  "security",
  "access",
  "sessions",
  "activity",
  "identities",
  "developer",
] as const;

export type User360Tab = (typeof USER360_TABS)[number];

export function isUser360Tab(v: unknown): v is User360Tab {
  return typeof v === "string" && (USER360_TABS as readonly string[]).includes(v);
}
