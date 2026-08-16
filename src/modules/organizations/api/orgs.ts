// Organizations (tenants) data layer. `GET /v1/tenants` is caller-scoped (the
// orgs you belong to) and now enriched with per-org member counts. Per-org
// DETAIL surfaces (members, analytics, billing, audit, auth-policy) are locked
// by the server to the *active* org, so the Org 360 renders them only for the
// current tenant and offers a "switch" CTA otherwise.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";

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
  // List-only enrichment.
  member_count?: number;
  mfa_enabled_count?: number;
}

export const ORG_KEYS = {
  all: ["tenants"] as const,
  authPolicy: (id: string) => ["org-auth-policy", id] as const,
  audit: (id: string) => ["org-audit", id] as const,
  members: (id: string) => ["org-members", id] as const,
};

/** All orgs the caller belongs to (enriched with member/MFA counts). */
export function useOrgs() {
  return useQuery({
    queryKey: ORG_KEYS.all,
    queryFn: () => api<{ items: Org[] }>("/v1/tenants"),
    staleTime: 30_000,
  });
}

/** A single org, sourced from the caller-scoped list (the by-id GET is locked to the active org). */
export function useOrg(orgId: string) {
  const q = useOrgs();
  return { ...q, org: q.data?.items.find((o) => o.id === orgId) };
}

// ── Detail surfaces (active-org only; caller gates `enabled` on isActiveOrg) ──

export interface OrgAuthPolicy {
  password_enabled: boolean;
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_number: boolean;
  password_require_symbol: boolean;
  magic_link_enabled: boolean;
  passkey_enabled: boolean;
  otp_email_enabled: boolean;
  otp_sms_enabled: boolean;
  self_registration_enabled: boolean;
  remember_device_enabled: boolean;
}

export function useOrgAuthPolicy(orgId: string, enabled: boolean) {
  return useQuery({
    queryKey: ORG_KEYS.authPolicy(orgId),
    queryFn: () => api<OrgAuthPolicy>(`/v1/tenants/${orgId}/auth-policy`),
    enabled: enabled && !!orgId,
    staleTime: 60_000,
  });
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
    queryKey: ORG_KEYS.audit(orgId),
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

/** Members of the ACTIVE org (GET /v1/users is JWT-tenant-scoped). */
export function useOrgMembers(orgId: string, enabled: boolean) {
  return useQuery({
    queryKey: ORG_KEYS.members(orgId),
    queryFn: () => api<{ items: OrgMember[] }>("/v1/users", { query: { limit: 50 } }),
    enabled: enabled && !!orgId,
    staleTime: 15_000,
  });
}

// ── Mutations ───────────────────────────────────────────────────────────────

export interface UpdateOrgBody {
  name?: string;
  status?: "active" | "suspended";
  region?: string;
  logo_url?: string;
}

export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateOrgBody }) =>
      api<Org>(`/v1/tenants/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ORG_KEYS.all }),
    meta: { successMessage: "Organization updated" },
  });
}

export function useDeleteOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/tenants/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ORG_KEYS.all }),
    meta: { successMessage: "Organization deleted" },
  });
}
