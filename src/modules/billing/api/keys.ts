// Every billing query key sits under ["billing", organizationId]; see src/modules/users/api/keys.ts. The
// plan catalogue is the platform's, so it sits outside any tenant.

export const billingKeys = {
  all: ["billing"] as const,
  plans: () => [...billingKeys.all, "plans"] as const,
  organization: (organizationId: string | null) => ["billing", organizationId] as const,
  entitlements: (organizationId: string | null) =>
    [...billingKeys.organization(organizationId), "entitlements"] as const,
  usage: (organizationId: string | null) =>
    [...billingKeys.organization(organizationId), "usage"] as const,
  profile: (organizationId: string | null) =>
    [...billingKeys.organization(organizationId), "profile"] as const,
  subscription: (organizationId: string | null) =>
    [...billingKeys.organization(organizationId), "subscription"] as const,
  invoices: (organizationId: string | null) =>
    [...billingKeys.organization(organizationId), "invoices"] as const,
};
