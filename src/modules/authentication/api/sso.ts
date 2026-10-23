import { useQuery } from "@tanstack/react-query";

import { ApiError, api } from "@/platform/api/client";
import { authKeys } from "./keys";

export interface SSODiscoveryHit {
  kind: "saml" | "oidc";
  provider_name: string;
  redirect_url: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

function emailLooksValid(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/**
 * Looks up SSO for an email's domain, so a corporate email can go straight to its IdP: null when
 * the domain has none, a query error for other failures. Pass an already-debounced email: every
 * change is a request.
 */
export function useSSODiscovery(email: string) {
  const trimmed = email.trim().toLowerCase();
  const enabled = emailLooksValid(trimmed);

  return useQuery({
    queryKey: authKeys.ssoDiscovery(trimmed),
    enabled,
    queryFn: async (): Promise<SSODiscoveryHit | null> => {
      try {
        return await api<SSODiscoveryHit>("/v1/sso/discovery", {
          query: { email: trimmed },
          anonymous: true,
        });
      } catch (err) {
        // 404: no SSO for the domain; 501: a server without discovery. Both keep the password path.
        if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 60_000,
    meta: { silent: true },
    retry: false,
  });
}
