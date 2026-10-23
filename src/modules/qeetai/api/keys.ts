// Qeet AI's availability is the deployment's, so its key sits outside any tenant; the provider
// key is each tenant's, under ["qeetai", tenantId]. See src/modules/users/api/keys.ts.

export const qeetaiKeys = {
  all: ["qeetai"] as const,
  status: () => [...qeetaiKeys.all, "status"] as const,
  tenant: (tenantId: string | null) => ["qeetai", tenantId] as const,
  providerConfig: (tenantId: string | null) =>
    [...qeetaiKeys.tenant(tenantId), "provider-config"] as const,
};
