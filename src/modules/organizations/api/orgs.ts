// `GET /v1/organizations` lists only the caller's orgs. The server locks per-org detail (its record,
// history, members, billing) to the active org, and changes or deletes only that one.

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import type { Answer, Body } from "@/platform/api/contract";
import {
  type EligibleOrganization,
  organizationSelectionPageSchema,
} from "@/platform/auth/organization-selection";

import { orgKeys } from "./keys";

/** One of the caller's organisations, as the list has it (with member and MFA counts). */
export type Org = Answer<"/v1/organizations">["items"][number];
/** The current organisation's own record, with its logo. */
export type OrgRecord = Answer<"/v1/organizations/{organizationID}">;

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
        items: await everyPage<Org>((cursor) =>
          backend.get("/v1/organizations", {
            query: { limit: PAGE, cursor: cursor || undefined },
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
          backend.get("/v1/me/organizations", {
            query: { limit: PAGE, cursor: cursor || undefined },
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
      queryFn: () =>
        backend.get("/v1/organizations/{organizationID}", {
          path: { organizationID: orgId ?? "" },
        }),
      enabled: !!orgId,
    }),
  /** The changes to the active org itself (audit events on the organization), newest first. */
  history: (orgId: string | null) =>
    queryOptions({
      queryKey: orgKeys.history(orgId),
      queryFn: ({ signal }) =>
        backend.get("/v1/organizations/{organizationID}/audit", {
          path: { organizationID: orgId ?? "" },
          query: { resource_type: "organization", limit: 100 },
          signal,
        }),
      enabled: !!orgId,
      staleTime: 15_000,
    }),
};

export function useOrgs(enabled = true) {
  return useQuery({ ...orgQueries.list(), enabled });
}

/** One change to the organisation itself, from its audit log. */
export type OrgAuditEvent = Answer<"/v1/organizations/{organizationID}/audit">["items"][number];

/**
 * What Settings › General changes. No status: the server always refuses suspending the
 * organisation you're in. No region: it's read-only after creation. `metadata` replaces the whole
 * object, so send every key you keep.
 */
export type UpdateOrgBody = Pick<
  Body<"/v1/organizations/{organizationID}", "patch">,
  "name" | "logo_url" | "metadata"
>;

/** Updates an org. `silentError` drops the error toast, for a form that shows it itself. */
export function useUpdateOrg({ silentError = false }: { silentError?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateOrgBody }) =>
      backend.patch("/v1/organizations/{organizationID}", { path: { organizationID: id }, body }),
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
      backend.delete("/v1/organizations/{organizationID}", { path: { organizationID: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
    meta: { successMessage: "organizations:toast.deletionScheduled" },
  });
}

/** Calls off the active org's scheduled deletion. Owners only. */
export function useCancelOrgDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      backend.post("/v1/organizations/{organizationID}/deletion/cancel", {
        path: { organizationID: id },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
    meta: { successMessage: "organizations:toast.deletionCancelled" },
  });
}
