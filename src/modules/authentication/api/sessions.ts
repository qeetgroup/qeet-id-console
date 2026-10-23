import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import i18n from "@/i18n";
import { api } from "@/platform/api/client";
import { authKeys } from "./keys";

const sessionStatusSchema = z.enum(["active", "revoked", "expired"]);

/**
 * active, revoked (ended by sign-out or revocation) or expired (reached its maximum age or idle
 * timeout first). Only an active session can be revoked.
 */
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

const sessionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  tenant_id: z.string(),
  ip: z.string().nullish(),
  user_agent: z.string().nullish(),
  created_at: z.string(),
  last_seen_at: z.string(),
  revoked_at: z.string().nullish(),
  expires_at: z.string().optional(), // When the session ends however active it is
  idle_expires_at: z.string().optional(), // When the session ends unless it is renewed first
  status: sessionStatusSchema.optional(),
  device: z.string().optional(), // The device and browser in words, e.g. "Chrome on macOS"
  device_kind: z.enum(["desktop", "mobile", "tablet", "unknown"]).optional(),
  country: z.string().optional(), // Where the session was opened (ISO 3166-1 alpha-2), when known
  current: z.boolean().optional(), // True for the session the list was requested with
});
/** A sign-in session as GET /v1/auth/sessions returns it; every session view renders this shape. */
export type Session = z.infer<typeof sessionSchema>;

const sessionListSchema = z.object({ items: z.array(sessionSchema) });
export type SessionList = z.infer<typeof sessionListSchema>;

/** Returns the caller's own sessions, rejecting a response that isn't a session list. */
export function listSessions(signal?: AbortSignal): Promise<SessionList> {
  return api("/v1/auth/sessions", { schema: sessionListSchema, signal });
}

/** Returns the session's device in words, as the server describes it (never the browser). */
export function sessionDevice(s: Session): string {
  return s.device || i18n.t("authentication:sessionsTable.unknownDevice");
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

export function sessionStatus(s: Session): SessionStatus {
  return s.status ?? (s.revoked_at ? "revoked" : "active");
}

export function useSessions() {
  return useQuery({
    queryKey: authKeys.sessions(),
    queryFn: () => listSessions(),
  });
}

/** Revokes one session; the list shows it revoked at once, and rolls back on a refusal. */
export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/auth/sessions/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: authKeys.sessions() });
      const previous = qc.getQueryData<SessionList>(authKeys.sessions());
      const now = new Date().toISOString();
      qc.setQueryData<SessionList>(
        authKeys.sessions(),
        (list) =>
          list && {
            ...list,
            items: list.items.map((s) =>
              s.id === id ? { ...s, revoked_at: now, status: "revoked" as const } : s,
            ),
          },
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => qc.setQueryData(authKeys.sessions(), ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: authKeys.sessions() }),
    meta: { successMessage: "authentication:toast.sessionRevoked" },
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

/** Ends every other session; the caller reports the outcome. */
export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeOtherSessions,
    onSettled: () => qc.invalidateQueries({ queryKey: authKeys.sessions() }),
    meta: { silent: true },
  });
}

/** Signs out everywhere, this console included; the caller reports it and leaves the console. */
export function useSignOutEverywhere() {
  return useMutation({ mutationFn: signOutEverywhere, meta: { silent: true } });
}
