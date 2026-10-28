// What the Connections list's address can narrow it to. The route defines its schema from these
// values itself (through this module's barrel it would bring the directory's API into the shell);
// the page's props take this type, so the two can't drift apart.

/** `?show=failing|draft`: the band's "needs a look" narrows the list to those. */
export const CONNECTION_SHOWS = ["failing", "draft"] as const;
export type ConnectionsFilters = { show?: (typeof CONNECTION_SHOWS)[number] };
