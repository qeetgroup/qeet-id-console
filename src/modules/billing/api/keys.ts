// Every billing query key sits under ["billing", tenantId]; see src/modules/users/api/keys.ts. The
// plan catalogue is the platform's, so it sits outside any tenant.

export const billingKeys = {
  all: ["billing"] as const,
  plans: () => [...billingKeys.all, "plans"] as const,
  tenant: (tenantId: string | null) => ["billing", tenantId] as const,
  entitlements: (tenantId: string | null) =>
    [...billingKeys.tenant(tenantId), "entitlements"] as const,
  usage: (tenantId: string | null) => [...billingKeys.tenant(tenantId), "usage"] as const,
  profile: (tenantId: string | null) => [...billingKeys.tenant(tenantId), "profile"] as const,
  subscription: (tenantId: string | null) =>
    [...billingKeys.tenant(tenantId), "subscription"] as const,
  invoices: (tenantId: string | null) => [...billingKeys.tenant(tenantId), "invoices"] as const,
};
