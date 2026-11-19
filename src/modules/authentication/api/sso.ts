import { useQuery } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import { ApiError, getApiBaseUrl } from "@/platform/api/client";
import { authKeys } from "./keys";

/** Where a corporate address signs in: its identity provider's name, and the URL to go to. */
export interface SSODiscoveryHit {
  provider_name: string;
  redirect_url: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

function emailLooksValid(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/**
 * Looks up SSO for an email's domain: null when it has none. Only a SAML or OpenID Connect
 * connection is offered: one that takes the directory password (LDAP) needs a form the console
 * doesn't have, so the password path stays and the server says why it refuses.
 */
export async function discoverSSO(email: string): Promise<SSODiscoveryHit | null> {
  try {
    const found = await backend.post("/v1/sso/discovery", { body: { email }, anonymous: true });
    const redirect = found.sso ? found.connections.find((c) => c.method === "redirect") : undefined;
    return redirect
      ? { provider_name: redirect.name, redirect_url: `${getApiBaseUrl()}${redirect.login_path}` }
      : null;
  } catch (err) {
    // 404 or 501: a server without discovery, which keeps the password path.
    if (err instanceof ApiError && (err.status === 404 || err.status === 501)) return null;
    throw err;
  }
}

/**
 * Looks up SSO as the address is typed, so a corporate email can go straight to its IdP; a query
 * error for a failure. Pass an already-debounced email: every change is a request.
 */
export function useSSODiscovery(email: string) {
  const trimmed = email.trim().toLowerCase();
  const enabled = emailLooksValid(trimmed);

  return useQuery({
    queryKey: authKeys.ssoDiscovery(trimmed),
    enabled,
    queryFn: () => discoverSSO(trimmed),
    staleTime: 60_000,
    meta: { silent: true },
    retry: false,
  });
}
