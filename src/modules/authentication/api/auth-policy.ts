// The tenant's authentication policy: password rules and permitted sign-in methods. PUT replaces
// the whole object, so each page loads it, edits its slice and saves the merged result. The server
// clamps the password length to 8–128 and the magic-link lifetime to 5–1440 minutes, and refuses a
// policy with no first-factor method on (password, passkey or magic link).

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import type { Answer, Schemas } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { authKeys } from "./keys";

/** One lockout: failed sign-ins before it locks, the window they count in, how long it lasts. */
export type LockoutSettings = Schemas<"access">["LockoutSettings"];

/**
 * The policy as the server answers it. Sign-in lockout: this many failed sign-ins to one account
 * from one network, each within the window of the last, lock it for that network for the duration
 * (null: the platform default), within lockout_limits, the read-only platform defaults and
 * inclusive bounds that PUT ignores. PUT replaces the whole policy, so a page saves only one it
 * holds in full.
 */
export type AuthPolicy = Answer<"/v1/organizations/{organizationID}/auth-policy">;

export const authPolicyQueries = {
  detail: (organizationId: string | null) =>
    queryOptions({
      queryKey: authKeys.policy(organizationId),
      queryFn: () =>
        backend.get("/v1/organizations/{organizationID}/auth-policy", {
          path: { organizationID: organizationId ?? "" },
        }),
      enabled: !!organizationId,
    }),
};

export function useAuthPolicy() {
  return useQuery(authPolicyQueries.detail(useOrganizationId()));
}

export function useUpdateAuthPolicy() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AuthPolicy) =>
      backend.put("/v1/organizations/{organizationID}/auth-policy", {
        path: { organizationID: organizationId ?? "" },
        body,
      }),
    onSuccess: (data) => qc.setQueryData(authKeys.policy(organizationId), data), // PUT returns the whole policy
    meta: { successMessage: "authentication:toast.authenticationPolicySaved", silentError: true }, // pages show it
  });
}
