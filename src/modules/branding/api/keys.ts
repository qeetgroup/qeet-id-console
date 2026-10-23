// Branding keys sit under ["branding", tenantId]; see src/modules/users/api/keys.ts.

export const brandingKeys = {
  all: ["branding"] as const,
  tenant: (tenantId: string | null) => ["branding", tenantId] as const,
};
