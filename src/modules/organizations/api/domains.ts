// Domain verification: a tenant claims an email domain, publishes the returned DNS TXT record, then
// verifies it. The reads, which the Dashboard and Branding share; the changes are Settings ›
// Domains' own (domain-changes.ts).

import { useQuery } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";

import { orgKeys } from "./keys";

/** A claimed email domain, with the DNS record that proves it and the latest check. */
export type OrganizationDomain =
  Answer<"/v1/organizations/{organizationID}/domains">["items"][number];
/** The organisation's own sign-in address: its DNS, certificate and endpoint, step by step. */
export type LoginDomainStatus = Answer<"/v1/organizations/{organizationID}/login-domain">;
export type DNSRecord = LoginDomainStatus["records"][number];

export function useDomains(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: orgKeys.domains(organizationId),
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/domains", {
        path: { organizationID: organizationId ?? "" },
      }),
    enabled: !!organizationId && enabled,
  });
}

/** Provisioning state of the tenant's custom hosted-login hostname. */
export function useLoginDomain(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: orgKeys.loginDomain(organizationId),
    enabled: !!organizationId && enabled,
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/login-domain", {
        path: { organizationID: organizationId ?? "" },
      }),
  });
}
