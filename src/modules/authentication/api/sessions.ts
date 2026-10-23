import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";

/** A sign-in session as GET /v1/auth/sessions returns it; every session view renders this shape. */
export type Session = {
  id: string;
  user_id: string;
  tenant_id: string;
  ip?: string | null;
  user_agent?: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at?: string | null;
  expires_at?: string; // When the session ends however active it is
  idle_expires_at?: string; // When the session ends unless it is renewed first
  status?: SessionStatus;
  device?: string; // The device and browser in words, from the server ("Chrome on macOS")
  device_kind?: "desktop" | "mobile" | "tablet" | "unknown";
  country?: string; // Where the session was opened (ISO 3166-1 alpha-2), when known
  current?: boolean; // True for the session the list was requested with
};

/** Returns the session's device in words, as the server describes it (never the browser). */
export function sessionDevice(s: Session): string {
  return s.device || "Unknown device";
}

/** Returns the name of the country a session was opened from, or "" when unknown. */
export function sessionCountry(s: Session, locale = "en"): string {
  if (!s.country) return "";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(s.country) ?? s.country;
  } catch {
    return s.country;
  }
}

/**
 * active, revoked (ended by sign-out or revocation) or expired (reached its maximum age or idle
 * timeout first). Only an active session can be revoked.
 */
export type SessionStatus = "active" | "revoked" | "expired";

export function sessionStatus(s: Session): SessionStatus {
  return s.status ?? (s.revoked_at ? "revoked" : "active");
}

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

/**
 * Ends all of the caller's sessions except the current one, all or nothing. The server keeps the
 * session behind this console's credential, so it also ends sessions the list hasn't loaded.
 * Resolves with how many ended (0 when there were none).
 */
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

/**
 * Signs the caller out everywhere, all or nothing: every session including this console's, the
 * hosted sign-in in every browser, and apps signed in with this account. Resolves with how many
 * sign-ins ended, after which the caller must send the person to sign in again; on rejection
 * they are still signed in here.
 */
export function signOutEverywhere(): Promise<SignOutEverywhereResult> {
  return api("/v1/auth/sessions/revoke-all", {
    method: "POST",
    schema: signOutEverywhereSchema,
  });
}
