import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";

// The active-session list (GET /v1/auth/sessions) + revoke. One typed source for
// every session view — the tenant/security list, the users-nav list, and the
// account self-view all render the same shape from the same endpoint.
export type Session = {
  id: string;
  user_id: string;
  tenant_id: string;
  ip?: string | null;
  user_agent?: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at?: string | null;
};

export const SESSIONS_KEY = ["sessions"] as const;

export function useSessions() {
  return useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: () => api<{ items: Session[] }>("/v1/auth/sessions"),
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/auth/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}
