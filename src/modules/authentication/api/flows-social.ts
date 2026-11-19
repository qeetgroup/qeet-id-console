// Platform social sign-in: the console's own Qeet ID accounts, tenant-less.

import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { backend } from "@/platform/api/backend";
import { getApiBaseUrl } from "@/platform/api/client";

import { isMfaChallenge, type LoginResponse } from "./flows-session";
import { authKeys } from "./keys";

/** Returns which platform-level social providers are configured (e.g. ["google"]). */
export function usePlatformSocialProviders() {
  return useQuery({
    queryKey: authKeys.platformSocialProviders(),
    queryFn: () => backend.get("/v1/social/platform/providers", { anonymous: true }),
    staleTime: 5 * 60_000,
  });
}

/**
 * Returns the backend URL that starts a platform social sign-in (a browser redirect).
 * intent="signup" may create an account; "login" requires an existing one, so signing in never
 * silently creates an account.
 */
export function socialStartUrl(provider: string, intent: "login" | "signup" = "login"): string {
  return `${getApiBaseUrl()}/v1/social/${provider}/start?intent=${intent}`;
}

/**
 * Starts linking a social provider to the signed-in account and redirects to the provider. The
 * request is authenticated, so the server keeps our identity in the OAuth state and the callback
 * attaches the provider to this account, never creating or switching one.
 */
export function useStartSocialLink() {
  return useMutation({
    mutationFn: (provider: string) =>
      backend.post("/v1/social/{provider}/link/start", { path: { provider } }),
    onSuccess: (res) => {
      if (typeof window !== "undefined" && res.authorize_url) {
        window.location.href = res.authorize_url;
      }
    },
    meta: { silent: true }, // success leaves the page; a failure toasts from the page
  });
}

/**
 * Exchanges the one-time social login code (delivered to /sign-in?social_code=… after the
 * provider redirect) for a tenant-less session, like sign-up's.
 */
export function useConsumeSocialCode() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (code: string): Promise<LoginResponse> =>
      backend.post("/v1/social/exchange", { body: { code }, anonymous: true }),
    onSuccess: (res) => {
      // No session yet: the sign-in page renders the second-factor step from this mutation's data.
      if (isMfaChallenge(res)) return;
      navigate({ to: "/" });
    },
    meta: { successMessage: "authentication:toast.signedInSuccessfully" },
  });
}
