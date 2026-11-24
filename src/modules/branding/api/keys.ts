// Branding keys sit under ["branding", organizationId]; see src/modules/users/api/keys.ts.

export const brandingKeys = {
  all: ["branding"] as const,
  organization: (organizationId: string | null) => ["branding", organizationId] as const,
};
