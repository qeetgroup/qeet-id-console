// Domain verification: a tenant claims an email domain, publishes the returned DNS TXT record, then
// verifies it. The reads, which the Dashboard and Branding share; the changes are Settings ›
// Domains' own (domain-changes.ts).

import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import { orgKeys } from "./keys";

export interface TenantDomain {
  id: string;
  domain: string;
  verification_token: string;
  dns_record_name: string;
  dns_record_type: string;
  dns_record_value: string;
  verified_at?: string | null;
  created_at: string;
  last_checked_at?: string | null; // when the latest verification attempt ran
  last_error?: string; // why that attempt failed
  sso_enabled: boolean;
  jit_enabled: boolean;
  is_default: boolean;
  status: "verified" | "pending" | "attention"; // server-derived; a failed check is attention
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

export function useDomains(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: orgKeys.domains(tenantId),
    queryFn: () => api<{ items: TenantDomain[] }>(`/v1/tenants/${tenantId}/domains`),
    enabled: !!tenantId && enabled,
  });
}

/** Provisioning state of the tenant's custom hosted-login hostname. */
export function useLoginDomain(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: orgKeys.loginDomain(tenantId),
    enabled: !!tenantId && enabled,
    queryFn: () => api<LoginDomainStatus>(`/v1/tenants/${tenantId}/login-domain`),
  });
}
