// Connected-account (social identity) self-service data layer. Lists the
// external identities linked to the current user and unlinks them. Backed by
// the self-service, tenant-independent GET /v1/me/social/identities and
// DELETE /v1/me/social/identities/{id} — so this works before joining any org.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "./api";

export interface SocialIdentity {
  id: string;
  provider: string;
  email?: string | null;
  linked_at: string;
}

const KEY = ["social-identities"];

// useSocialIdentities lists the current user's linked social accounts via the
// self endpoint (resolves the caller from the token, no tenant needed). Returns
// [] gracefully when the endpoint is absent so the card still renders empty.
export function useSocialIdentities() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<{ items: SocialIdentity[] }> => {
      try {
        return await api<{ items: SocialIdentity[] }>(`/v1/me/social/identities`);
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
    mutationFn: (id: string) => api<void>(`/v1/me/social/identities/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
