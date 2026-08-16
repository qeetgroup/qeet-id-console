// Ambient session identity for the console operator: the active tenant/user,
// the current-user fetch, idle logout, and UX-only JWT introspection (the
// impersonation `act` claim). This is platform state consumed across the app
// (route guards, capability provider, header) — the pre-login auth *flows*
// (login/signup/invite/…) live in features/auth.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { api } from "@/platform/api/client";
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
  });
}

const IDLE_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

/**
 * Logs the user out after `timeoutMs` of inactivity (no mouse/keyboard/touch).
 * Mount in any component that only renders while the user is authenticated.
 */
export function useIdleLogout(timeoutMs: number) {
  const logout = useLogout();
  // Keep a stable ref so the event-listener closure always calls the current mutate.
  const mutateRef = useRef(logout.mutate);
  mutateRef.current = logout.mutate;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => mutateRef.current(), timeoutMs);
    };

    IDLE_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer);
      IDLE_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [timeoutMs]);
}

/** Returns the current tenant id stashed in localStorage. */
export function useTenantId(): string | null {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getTenantId, () => null);
}

export function useUserId(): string | null {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getUserId, () => null);
}

// ---------------------------------------------------------------------------
// JWT introspection
//
// We never trust the JWT payload for authorization decisions (the server
// re-validates on every request). We DO read it client-side to drive
// UX-only signals — e.g. the impersonation banner, which checks for the
// RFC 8693 `act` claim and surfaces who the admin is acting as.
// ---------------------------------------------------------------------------

export interface ImpersonationActor {
  /** The user being impersonated (the `sub` of the current token). */
  targetSubject: string;
  /** The admin doing the impersonating. */
  actorSubject: string;
  actorEmail?: string;
  actorDisplayName?: string;
}

/**
 * Returns the impersonation context if the current access token was
 * issued via an impersonation grant (RFC 8693 `act` claim present),
 * otherwise null. UI-only signal — server is the source of truth.
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

type Me = {
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
 * Fetch the current user via `GET /v1/me` using the user_id persisted at
 * login/signup time. Resolves to the caller from the token, so it works even
 * for a tenant-less user (fresh signup).
 */
export function useMe() {
  const userId = useUserId();
  return useQuery({
    queryKey: ["me", userId],
    // Self endpoint: resolves to the caller from the token, so it works even for
    // a tenant-less user (fresh signup) — unlike /v1/users/{id}, which is the
    // tenant-admin route and 403s ("tenant scope required") without an organization.
    queryFn: () => api<Me>(`/v1/me`),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
