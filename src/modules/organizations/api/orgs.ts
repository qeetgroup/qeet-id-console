// `GET /v1/tenants` lists only the caller's orgs. The server locks per-org detail (members,
// analytics, billing, audit, auth policy) to the active org, so detail queries are enabled for it
// alone.

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";

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
  member_count?: number; // list responses only
  mfa_enabled_count?: number; // list responses only
}

export const orgQueries = {
  /** The orgs the caller belongs to, with member and MFA counts. */
  list: () =>
    queryOptions({
      queryKey: orgKeys.list(),
      queryFn: () => api<{ items: Org[] }>("/v1/tenants"),
      staleTime: 30_000,
    }),
  /** One org's own record; the server serves it for the active org only. */
  record: (orgId: string | null) =>
    queryOptions({
      queryKey: orgKeys.record(orgId),
      queryFn: () => api<Org>(`/v1/tenants/${orgId}`),
      enabled: !!orgId,
    }),
};

export function useOrgs(enabled = true) {
  return useQuery({ ...orgQueries.list(), enabled });
}

/** Returns one org from the caller's list, since the by-id GET serves only the active org. */
export function useOrg(orgId: string) {
  const q = useOrgs();
  return { ...q, org: q.data?.items.find((o) => o.id === orgId) };
}

export interface OrgAuditEvent {
  id: string;
  actor_user_id?: string | null;
  actor_type?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  ip?: string | null;
  created_at: string;
}

export function useOrgAudit(orgId: string, enabled: boolean) {
  return useQuery({
    queryKey: orgKeys.audit(orgId),
    queryFn: () =>
      api<{ items: OrgAuditEvent[] }>(`/v1/tenants/${orgId}/audit`, { query: { limit: 20 } }),
    enabled: enabled && !!orgId,
    staleTime: 15_000,
  });
}

export interface OrgMember {
  id: string;
  email: string;
  display_name?: string | null;
  status: string;
  roles?: string[] | null;
  mfa_enabled?: boolean;
  last_seen_at?: string | null;
}

/** Lists members of the active org; `/v1/users` is scoped by the session, not by `orgId`. */
export function useOrgMembers(orgId: string, enabled: boolean) {
  return useQuery({
    queryKey: orgKeys.members(orgId),
    queryFn: () => api<{ items: OrgMember[] }>("/v1/users", { query: { limit: 50 } }),
    enabled: enabled && !!orgId,
    staleTime: 15_000,
  });
}

export interface UpdateOrgBody {
  name?: string;
  status?: "active" | "suspended";
  region?: string;
  logo_url?: string;
}

/** Updates an org. `silentError` drops the error toast, for a form that shows it itself. */
export function useUpdateOrg({ silentError = false }: { silentError?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateOrgBody }) =>
      api<Org>(`/v1/tenants/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
    meta: { successMessage: "Organization updated", silentError },
  });
}

export function useDeleteOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/tenants/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
    meta: { successMessage: "Organization deleted" },
  });
}
