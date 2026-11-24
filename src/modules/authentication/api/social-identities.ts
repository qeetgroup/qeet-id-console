// The signed-in user's linked social identities. The endpoints are tenant-independent, so this
// works before the user joins an organization.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/platform/api/client";

import { refreshSignInMethods } from "./sign-in-methods";
import { authKeys } from "./keys";
import { backend } from "@/platform/api/backend";

export interface SocialIdentity {
  id: string;
  provider: string;
  email?: string | null;
  linked_at: string;
}

/** Returns the current user's linked social accounts; [] when the server lacks the endpoint. */
export function useSocialIdentities() {
  return useQuery({
    queryKey: authKeys.socialIdentities(),
    queryFn: async (): Promise<{ items: SocialIdentity[] }> => {
      try {
        return await backend.get("/v1/me/social/identities");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
          return { items: [] };
        }
        throw err;
      }
    },
    staleTime: 60_000,
    meta: { silent: true },
    retry: false,
  });
}

export function useUnlinkIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backend.delete("/v1/me/social/identities/{id}", { path: { id } }),
    onSuccess: () => {
      void refreshSignInMethods(qc);
      return qc.invalidateQueries({ queryKey: authKeys.socialIdentities() });
    },
    meta: { successMessage: "authentication:toast.identityUnlinked" },
  });
}
