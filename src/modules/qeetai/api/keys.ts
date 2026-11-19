// Everything Qeet AI caches is the organisation's, under ["qeetai", organizationId]: whether it's on
// (the organisation's own key works on any plan) and the provider key's masked settings. See
// src/modules/users/api/keys.ts.

export const qeetaiKeys = {
  all: ["qeetai"] as const,
  organization: (organizationId: string | null) => ["qeetai", organizationId] as const,
  status: (organizationId: string | null) =>
    [...qeetaiKeys.organization(organizationId), "status"] as const,
  providerConfig: (organizationId: string | null) =>
    [...qeetaiKeys.organization(organizationId), "provider-config"] as const,
};
