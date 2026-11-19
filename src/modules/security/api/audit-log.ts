// The organisation's audit log, filtered and cursor-paged, and its export. The list leaves each
// event's metadata out; one event's details come from audit-event.ts.

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

export type AuditPage = Answer<"/v1/organizations/{organizationID}/audit">;
export type AuditEvent = AuditPage["items"][number];

/** The filters the log takes; an empty string means unfiltered. */
export interface AuditLogFilters {
  q: string;
  action: string;
  resource_type: string;
  actor_user_id: string;
}

/** Rows a page of the log can hold; the server takes 1 to 200. */
export const AUDIT_PAGE_SIZES = [25, 50, 100] as const;
const EXPORT_PAGE_SIZE = 200;

function fetchAuditPage(
  organizationId: string | null,
  filters: AuditLogFilters,
  cursor: string | undefined,
  limit: number,
) {
  return backend.get("/v1/organizations/{organizationID}/audit", {
    path: { organizationID: organizationId ?? "" },
    query: {
      limit,
      cursor,
      q: filters.q || undefined,
      action: filters.action || undefined,
      resource_type: filters.resource_type || undefined,
      actor_user_id: filters.actor_user_id || undefined,
    },
  });
}

/** One page of the log; the previous page stays on screen while the next loads. */
export function useAuditLog(
  filters: AuditLogFilters,
  cursor: string | undefined,
  pageSize: number = AUDIT_PAGE_SIZES[0],
) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.auditLog(organizationId, { ...filters, pageSize }, cursor),
    queryFn: () => fetchAuditPage(organizationId, filters, cursor, pageSize),
    enabled: !!organizationId,
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetches every matching event, newest first, up to `cap` so the loop can't run forever;
 * `truncated` says the cap cut it short.
 */
export async function fetchAuditExport(
  organizationId: string,
  filters: AuditLogFilters,
  cap: number,
): Promise<{ items: AuditEvent[]; truncated: boolean }> {
  const items: AuditEvent[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchAuditPage(organizationId, filters, cursor, EXPORT_PAGE_SIZE);
    items.push(...page.items);
    cursor = page.next_cursor;
    if (items.length >= cap) return { items, truncated: true };
  } while (cursor);
  return { items, truncated: false };
}
