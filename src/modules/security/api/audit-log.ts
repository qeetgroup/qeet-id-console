// The organisation's audit log, filtered and cursor-paged, and its export. The list leaves each
// event's metadata out; one event's details come from audit-event.ts.

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

export interface AuditEvent {
  id: string;
  tenant_id: string;
  actor_user_id?: string | null;
  actor_type: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  request_id?: string | null;
  /** Not in the list's answer today; kept for a server that sends it. */
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface AuditPage {
  items: AuditEvent[];
  next_cursor?: string;
}

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
  tenantId: string | null,
  filters: AuditLogFilters,
  cursor: string | undefined,
  limit: number,
) {
  return api<AuditPage>(`/v1/tenants/${tenantId}/audit`, {
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
  const tenantId = useTenantId();
  return useQuery({
    queryKey: securityKeys.auditLog(tenantId, { ...filters, pageSize }, cursor),
    queryFn: () => fetchAuditPage(tenantId, filters, cursor, pageSize),
    enabled: !!tenantId,
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetches every matching event, newest first, up to `cap` so the loop can't run forever;
 * `truncated` says the cap cut it short.
 */
export async function fetchAuditExport(
  tenantId: string,
  filters: AuditLogFilters,
  cap: number,
): Promise<{ items: AuditEvent[]; truncated: boolean }> {
  const items: AuditEvent[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchAuditPage(tenantId, filters, cursor, EXPORT_PAGE_SIZE);
    items.push(...page.items);
    cursor = page.next_cursor;
    if (items.length >= cap) return { items, truncated: true };
  } while (cursor);
  return { items, truncated: false };
}
