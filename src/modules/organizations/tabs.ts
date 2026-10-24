/**
 * The organization detail tabs in display order; the route deep-links the active one as `?tab=`.
 * Kept out of the page so the route's search validation doesn't pull the pages into the shell.
 */
export const ORG_TABS = ["overview", "members", "security", "billing", "activity"] as const;

export type OrgTab = (typeof ORG_TABS)[number];
