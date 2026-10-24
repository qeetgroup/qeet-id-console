// The organizations the caller belongs to are one list across tenants; everything about one
// organization sits under ["organizations", orgId], the org id being its tenant id.

export const orgKeys = {
  all: ["organizations"] as const,
  list: () => [...orgKeys.all, "list"] as const, // the caller's organizations
  org: (orgId: string | null) => [...orgKeys.all, orgId] as const,
  record: (orgId: string | null) => [...orgKeys.org(orgId), "record"] as const, // GET /v1/tenants/{id}
  audit: (orgId: string | null) => [...orgKeys.org(orgId), "audit"] as const,
  members: (orgId: string | null) => [...orgKeys.org(orgId), "members"] as const,
  domains: (orgId: string | null) => [...orgKeys.org(orgId), "domains"] as const,
  loginDomain: (orgId: string | null) => [...orgKeys.org(orgId), "login-domain"] as const,
  emailTemplates: (orgId: string | null) => [...orgKeys.org(orgId), "email-templates"] as const,
  securityPolicy: (orgId: string | null) => [...orgKeys.org(orgId), "security-policy"] as const,
};
