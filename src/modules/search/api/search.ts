// Server-side search across the organization's resources, behind the command palette.

import { useQuery } from "@tanstack/react-query";

import { ApiError, api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import type { SearchResponse } from "../registry/types/registry.types";

const MAX_RESOURCE_RESULTS = 10;
const MIN_QUERY_LENGTH = 2;

// Every search query key sits under ["search", tenantId]; see src/modules/users/api/keys.ts.
export const searchKeys = {
  all: ["search"] as const,
  results: (tenantId: string | null, query: string) => ["search", tenantId, query] as const,
};

/** Searches resources for `query` once it is long enough; a failure yields no results. */
export function useResourceSearch(query: string, enabled: boolean) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: searchKeys.results(tenantId, query),
    queryFn: async ({ signal }) => {
      try {
        return await api<SearchResponse>("/v1/search", {
          query: { q: query, limit: MAX_RESOURCE_RESULTS },
          signal,
        });
      } catch (err) {
        // An abort must propagate so TanStack Query treats the request as cancelled.
        if (err instanceof Error && err.name === "AbortError") throw err;
        // Any other failure means no resource results rather than a broken palette.
        if (err instanceof ApiError || err instanceof Error) {
          return { results: [], next_cursor: undefined } satisfies SearchResponse;
        }
        throw err;
      }
    },
    enabled: enabled && query.length >= MIN_QUERY_LENGTH,
    // Keeps the previous results visible while a new query loads, avoiding flicker.
    placeholderData: (prev) => prev,
    staleTime: 10_000,
    retry: false,
    meta: { silent: true },
  });
}
