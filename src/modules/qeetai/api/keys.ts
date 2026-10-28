// Everything Qeet AI caches is the organisation's, under ["qeetai", tenantId]: whether it's on
// (the organisation's own key works on any plan) and the provider key's masked settings. See
// src/modules/users/api/keys.ts.

export const qeetaiKeys = {
  all: ["qeetai"] as const,
  tenant: (tenantId: string | null) => ["qeetai", tenantId] as const,
  status: (tenantId: string | null) => [...qeetaiKeys.tenant(tenantId), "status"] as const,
  providerConfig: (tenantId: string | null) =>
    [...qeetaiKeys.tenant(tenantId), "provider-config"] as const,
};
