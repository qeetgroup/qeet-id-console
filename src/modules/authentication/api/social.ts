// Tenant social-provider configuration (Authentication → Social).
//
// Lives here rather than inline in the route because two surfaces now read it —
// the Social page and the Authentication overview — and `docs/llm/workflows.md`
// requires data access to sit in a module's api/ dir, never in a component.
//
// Note the provider *catalogue* (logos, icon classes, discovery URLs) stays in
// the route: that is presentation, not data.

import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

export interface SocialProvider {
  tenant_id: string;
  provider: string;
  client_id: string;
  discovery_url: string;
  enabled: boolean;
  updated_at: string;
}

export const SOCIAL_PROVIDERS_KEY = ["social-providers"] as const;

/** Providers configured for the current tenant. */
export function useSocialProviders(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...SOCIAL_PROVIDERS_KEY, tenantId],
    enabled: enabled && !!tenantId,
    queryFn: () => api<{ items: SocialProvider[] }>(`/v1/tenants/${tenantId}/social/providers`),
  });
}
