import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { fetchTimelinePage } from "./timeline-history";
import type { TimelineFilters } from "./timeline-store";

const DEBOUNCE_MS = 400;

/**
 * Loads a user's timeline with cursor pagination. `q` is debounced so typing doesn't send a
 * request per keystroke; the other filters apply at once.
 */
export function useIdentityTimeline(userId: string, filters: TimelineFilters, enabled = true) {
  const [debouncedQ, setDebouncedQ] = useState(filters.q);

  useEffect(() => {
    if (filters.q === debouncedQ) return;
    const id = setTimeout(() => setDebouncedQ(filters.q), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [filters.q, debouncedQ]);

  const effectiveFilters: TimelineFilters = { ...filters, q: debouncedQ };

  return useInfiniteQuery({
    queryKey: ["identity-timeline", userId, effectiveFilters] as const,
    queryFn: ({ pageParam }: { pageParam: string }) =>
      fetchTimelinePage(userId, effectiveFilters, pageParam),
    initialPageParam: "",
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: enabled && !!userId,
    staleTime: 30_000,
    // Keeps the previous pages on screen while new filters load, avoiding a blank flash.
    placeholderData: (prev) => prev,
    meta: { silent: true },
  });
}
