// The organizations the caller belongs to are one list across tenants; everything about one
// organization sits under ["organizations", orgId], the org id being its tenant id.

export const orgKeys = {
  all: ["organizations"] as const,
  list: () => [...orgKeys.all, "list"] as const, // the caller's organizations
  memberships: () => [...orgKeys.all, "memberships"] as const, // their roles and last use in each
  invitations: () => [...orgKeys.all, "invitations"] as const, // organisations waiting for an answer
  org: (orgId: string | null) => [...orgKeys.all, orgId] as const,
  record: (orgId: string | null) => [...orgKeys.org(orgId), "record"] as const, // GET /v1/tenants/{id}
  history: (orgId: string | null) => [...orgKeys.org(orgId), "history"] as const, // its own changes
  domains: (orgId: string | null) => [...orgKeys.org(orgId), "domains"] as const,
  loginDomain: (orgId: string | null) => [...orgKeys.org(orgId), "login-domain"] as const,
  emailTemplates: (orgId: string | null) => [...orgKeys.org(orgId), "email-templates"] as const,
  securityPolicy: (orgId: string | null) => [...orgKeys.org(orgId), "security-policy"] as const,
};
