// The directory's events, for Sync activity and the Connections band: apart from the reads the
// shell carries through the Dashboard (directory.ts), so their schemas load with those pages only.

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { READ_PAGE, useCursorList } from "@/platform/query/cursor-list";
import { type EventFilters, filterQuery } from "./directory";
import { directoryKeys } from "./keys";

const ACTIVITY = "/v1/organizations/{organizationID}/directory/activity" as const;
export type DirectoryEventPage = Answer<typeof ACTIVITY>;

/** One read of the activity list, from `cursor`; a status the server lacks means no filter. */
export function readDirectoryEvents(
  organizationId: string,
  filters: EventFilters,
  cursor?: string,
  signal?: AbortSignal,
) {
  const { status, ...rest } = filterQuery(filters);
  return backend.get(ACTIVITY, {
    path: { organizationID: organizationId ?? "" },
    query: {
      ...rest,
      status:
        status === "success" || status === "warning" || status === "failed" ? status : undefined,
      cursor,
    },
    signal,
  });
}

/** The activity list a page at a time: `offset` and `pageSize` are the page on show. */
export function useDirectoryEventList(filters: EventFilters, offset: number, pageSize: number) {
  const organizationId = useOrganizationId();
  const access = useCapabilities();
  return useCursorList(
    [...directoryKeys.events(organizationId, filters), "list"],
    (cursor, signal) =>
      readDirectoryEvents(organizationId ?? "", { ...filters, limit: READ_PAGE }, cursor, signal),
    { offset, pageSize, enabled: !!organizationId && access.can("connection.read") },
  );
}

/** `keep`: a list's next page or filter keeps the rows on show while it loads. */
export function useDirectoryEvents(filters: EventFilters, enabled = true, { keep = false } = {}) {
  const organizationId = useOrganizationId();
  const access = useCapabilities();
  return useQuery({
    queryKey: directoryKeys.events(organizationId, filters),
    queryFn: ({ signal }) => readDirectoryEvents(organizationId ?? "", filters, undefined, signal),
    enabled: !!organizationId && access.can("connection.read") && enabled,
    staleTime: 15_000,
    placeholderData: keep ? keepPreviousData : undefined,
  });
}
