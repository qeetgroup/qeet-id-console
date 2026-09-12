// Domain-verification data layer (Organizations → Domains). A tenant claims an
// email domain, publishes the returned DNS TXT record, then verifies it.
// Backed by /v1/tenants/{tenantID}/domains[/{id}/verify].

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

export interface TenantDomain {
  id: string;
  domain: string;
  verification_token: string;
  dns_record_name: string;
  dns_record_type: string;
  dns_record_value: string;
  verified_at?: string | null;
  created_at: string;
  /** Outcome of the most recent verification attempt. */
  last_checked_at?: string | null;
  last_error?: string;
  sso_enabled: boolean;
  jit_enabled: boolean;
  is_default: boolean;
  /** Derived server-side: a failed check is "attention", an unchecked one "pending". */
  status: "verified" | "pending" | "attention";
}

export interface DNSRecord {
  type: string;
  name: string;
  value: string;
}

export interface LoginDomainStatus {
  login_domain: string;
  status: "not_configured" | "pending" | "active";
  dns_verified: boolean;
  dns_checked_at?: string | null;
  dns_detail: string;
  tls_state: "not_started" | "pending" | "issued";
  tls_detail: string;
  endpoint_state: "not_available" | "live";
  endpoint_url?: string;
  records: DNSRecord[];
}

const KEY = ["domains"];

export function useDomains(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...KEY, tenantId],
    queryFn: () => api<{ items: TenantDomain[] }>(`/v1/tenants/${tenantId}/domains`),
    enabled: !!tenantId && enabled,
  });
}

export function useAddDomain() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) =>
      api<TenantDomain>(`/v1/tenants/${tenantId}/domains`, {
        method: "POST",
        body: { domain },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    meta: { successMessage: "Domain added" },
  });
}

export function useVerifyDomain() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<TenantDomain>(`/v1/tenants/${tenantId}/domains/${id}/verify`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    meta: { successMessage: "Domain verified" },
  });
}

export function useRemoveDomain() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/tenants/${tenantId}/domains/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    meta: { successMessage: "Domain removed" },
  });
}

export function useUpdateDomainSettings() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: {
      id: string;
      sso_enabled?: boolean;
      jit_enabled?: boolean;
      is_default?: boolean;
    }) => {
      const { id, ...body } = in_;
      return api<TenantDomain>(`/v1/tenants/${tenantId}/domains/${id}`, {
        method: "PATCH",
        body,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    meta: { successMessage: "Domain updated" },
  });
}

/** Provisioning state of the tenant's custom hosted-login hostname. */
export function useLoginDomain(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...KEY, "login", tenantId],
    enabled: !!tenantId && enabled,
    queryFn: () => api<LoginDomainStatus>(`/v1/tenants/${tenantId}/login-domain`),
  });
}
