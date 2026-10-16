import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

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
    meta: { successMessage: "Session revoked" },
  });
}

const revokeOtherSessionsSchema = z.object({ revoked: z.number().int().nonnegative() });
export type RevokeOtherSessionsResult = z.infer<typeof revokeOtherSessionsSchema>;

// Ends every one of the caller's sessions except the current one, in a single
// all-or-nothing server call (POST /v1/auth/sessions/revoke-others). The server
// keeps the session behind this console's own credential and ends the rest —
// including any the session list has not loaded — so nothing here names a
// session. Resolves with how many sessions ended (0 when there were none);
// rejects when the call fails — the server ends all of them or none.
export function revokeOtherSessions(): Promise<RevokeOtherSessionsResult> {
  return api("/v1/auth/sessions/revoke-others", {
    method: "POST",
    schema: revokeOtherSessionsSchema,
  });
}

const signOutEverywhereSchema = z.object({
  revoked: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative().optional(),
  hosted_login_sessions: z.number().int().nonnegative().optional(),
  app_grants: z.number().int().nonnegative().optional(),
});
export type SignOutEverywhereResult = z.infer<typeof signOutEverywhereSchema>;

// Signs the caller out everywhere in one all-or-nothing server call
// (POST /v1/auth/sessions/revoke-all): every session including the one this
// console uses, the hosted sign-in in every browser, and the apps signed in
// with this account. Resolves with how many sign-ins ended (`revoked`, all
// places together); on success the console's own session has ended as well, so
// the caller must send the person to sign in again. Rejects when the call fails
// — the person is then still signed in here.
export function signOutEverywhere(): Promise<SignOutEverywhereResult> {
  return api("/v1/auth/sessions/revoke-all", {
    method: "POST",
    schema: signOutEverywhereSchema,
  });
}
