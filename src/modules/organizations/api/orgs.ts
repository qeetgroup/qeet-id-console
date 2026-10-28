// `GET /v1/tenants` lists only the caller's orgs. The server locks per-org detail (its record,
// history, members, billing) to the active org, and changes or deletes only that one.

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import {
  type EligibleOrganization,
  organizationSelectionPageSchema,
} from "@/platform/auth/organization-selection";

import { orgKeys } from "./keys";

export type OrgStatus = "active" | "suspended" | "deleted";

export interface Org {
  id: string;
  slug: string;
  name: string;
  status: OrgStatus;
  plan: string;
  region: string;
  logo_url: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
  /** When a scheduled deletion takes effect; the single GET only, until QTID-963. */
  deletion_due_at?: string | null;
  member_count?: number; // list responses only
  mfa_enabled_count?: number; // list responses only
}

const PAGE = 200; // the server's most per page

/** Every page of a cursor-paged list, in order; a cursor that doesn't move ends it. */
async function everyPage<T>(
  load: (cursor: string) => Promise<{ items: T[]; next_cursor?: string | null }>,
): Promise<T[]> {
  const out: T[] = [];
  const seen = new Set<string>();
  let cursor = "";
  do {
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const page = await load(cursor);
    out.push(...page.items);
    cursor = page.next_cursor ?? "";
  } while (cursor);
  return out;
}

export const orgQueries = {
  /** The orgs the caller belongs to, with member and MFA counts: every page of them. */
  list: () =>
    queryOptions({
      queryKey: orgKeys.list(),
      queryFn: async ({ signal }) => ({
        items: await everyPage((cursor) =>
          api<{ items: Org[]; next_cursor?: string }>("/v1/tenants", {
            query: { limit: PAGE, cursor },
            signal,
          }),
        ),
      }),
      staleTime: 30_000,
    }),
  /** The caller's place in each active org: their roles, when they last opened it, its domain. */
  memberships: () =>
    queryOptions({
      queryKey: orgKeys.memberships(),
      queryFn: ({ signal }) =>
        everyPage<EligibleOrganization>((cursor) =>
          api("/v1/me/organizations", {
            query: { limit: PAGE, cursor },
            signal,
            schema: organizationSelectionPageSchema,
          }),
        ),
      staleTime: 30_000,
    }),
  /** One org's own record; the server serves it for the active org only. */
  record: (orgId: string | null) =>
    queryOptions({
      queryKey: orgKeys.record(orgId),
      queryFn: () => api<Org>(`/v1/tenants/${orgId}`),
      enabled: !!orgId,
    }),
  /** The changes to the active org itself (audit events on the tenant), newest first. */
  history: (orgId: string | null) =>
    queryOptions({
      queryKey: orgKeys.history(orgId),
      queryFn: ({ signal }) =>
        api<{ items: OrgAuditEvent[]; next_cursor?: string }>(`/v1/tenants/${orgId}/audit`, {
          query: { resource_type: "tenant", limit: 100 },
          signal,
        }),
      enabled: !!orgId,
      staleTime: 15_000,
    }),
};

export function useOrgs(enabled = true) {
  return useQuery({ ...orgQueries.list(), enabled });
}

export interface OrgAuditEvent {
  id: string;
  actor_user_id?: string | null;
  actor_type?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

/**
 * What Settings › General changes. No status: the server always refuses suspending the
 * organisation you're in. No region: it's read-only after creation. `metadata` replaces the whole
 * object, so send every key you keep.
 */
export interface UpdateOrgBody {
  name?: string;
  logo_url?: string;
  metadata?: Record<string, unknown>;
}

/** Updates an org. `silentError` drops the error toast, for a form that shows it itself. */
export function useUpdateOrg({ silentError = false }: { silentError?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateOrgBody }) =>
      api<Org>(`/v1/tenants/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
    meta: { successMessage: "organizations:toast.organizationUpdated", silentError },
  });
}

/**
 * Schedules the active org's deletion: the server deletes it 7 days later, and any owner can call
 * it off until then. Owners only.
 */
export function useScheduleOrgDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ tenant_id: string; deletion_due_at: string }>(`/v1/tenants/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
    meta: { successMessage: "organizations:toast.deletionScheduled" },
  });
}

/** Calls off the active org's scheduled deletion. Owners only. */
export function useCancelOrgDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<Org>(`/v1/tenants/${id}/deletion/cancel`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
    meta: { successMessage: "organizations:toast.deletionCancelled" },
  });
}
