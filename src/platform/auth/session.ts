// The signed-in operator's session for React: tenant and user ids, the current user, idle
// logout and the impersonation signal, all read from the in-memory session store.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { api } from "@/platform/api/client";
import { watchIdle } from "@/platform/auth/idle-activity";
import { sessionStore } from "@/platform/auth/session-store";

export function useLogout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/v1/auth/logout", { method: "POST" }).catch(() => undefined),
    onSettled: () => {
      sessionStore.clear();
      qc.clear();
      navigate({ to: "/sign-in" });
    },
    meta: { successMessage: "common:toast.signedOutSuccessfully" },
  });
}

/**
 * Logs the user out after `timeoutMs` without mouse, keyboard or touch activity in any of the
 * console's tabs. Mount in any component that only renders while the user is authenticated.
 */
export function useIdleLogout(timeoutMs: number) {
  const logout = useLogout();
  const mutateRef = useRef(logout.mutate); // the idle callback always calls the current mutate
  mutateRef.current = logout.mutate;

  useEffect(() => watchIdle({ timeoutMs, onIdle: () => mutateRef.current() }), [timeoutMs]);
}

/** Returns the active tenant id from the in-memory session store. */
export function useTenantId(): string | null {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getTenantId, () => null);
}

export function useUserId(): string | null {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getUserId, () => null);
}

export interface ImpersonationActor {
  targetSubject: string; // the impersonated user, the token's `sub`
  actorSubject: string; // the admin doing the impersonating
  actorEmail?: string;
  actorDisplayName?: string;
}

/**
 * Returns who is impersonating the current user, from the access token's RFC 8693 `act` claim
 * as read on the server, or null. A UX signal only: the server decides access.
 */
export function useImpersonationActor(): ImpersonationActor | null {
  return useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.getImpersonationActor,
    () => null,
  );
}

export function useSessionId(): string | null {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getSessionId, () => null);
}

export type Me = {
  id: string;
  tenant_id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  email_verified_at?: string | null;
  status: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * Fetches the signed-in user from `GET /v1/me`, keyed by user id. The self endpoint resolves the
 * caller from the token, so unlike /v1/users/{id} it works before the user has an organization.
 */
/** The signed-in person's profile, keyed by user id; `all` refreshes it after a change. */
export const meKeys = {
  all: ["me"] as const,
  user: (userId: string | null) => ["me", userId] as const,
};

export function useMe() {
  const userId = useUserId();
  return useQuery({
    queryKey: meKeys.user(userId),
    queryFn: () => api<Me>(`/v1/me`),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
