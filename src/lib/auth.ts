// Auth hooks built on top of the api() client. Login / signup mutations
// persist the access token, refresh token, tenant_id and user_id so every
// downstream useQuery call sees a Bearer header automatically.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { api, API_BASE_URL, tokenStore } from "./api";

type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: string;
  user_id: string;
  session_id: string;
};

type User = {
  id: string;
  tenant_id: string;
  email: string;
  display_name?: string | null;
  status: string;
};

type LoginInput = { email: string; password: string };
type SessionResponse = TokenPair & { tenant_id?: string };
// When the account has a second factor enrolled, /v1/auth/login returns this
// challenge instead of tokens; complete it at /v1/auth/mfa.
export type MfaChallenge = {
  mfa_required: true;
  mfa_token: string;
  methods: string[];
};
type LoginResponse = SessionResponse | MfaChallenge;

export function isMfaChallenge(r: LoginResponse): r is MfaChallenge {
  return "mfa_required" in r && r.mfa_required === true;
}

export function useLogin() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (in_: LoginInput) =>
      api<LoginResponse>("/v1/auth/login", {
        method: "POST",
        body: in_,
        anonymous: true,
      }),

    onSuccess: (res) => {
      // A second factor is required — don't persist anything yet. The sign-in
      // page reads this mutation's data and renders the code step, completed
      // via useCompleteMfaLogin.
      if (isMfaChallenge(res)) return;

      // Clear prior session so a tenant-less/different user doesn't inherit a stale organization.
      tokenStore.clear();
      tokenStore.set(res.access_token);
      tokenStore.setRefresh(res.refresh_token);

      if (res.tenant_id) {
        tokenStore.setTenantId(res.tenant_id);
      }

      tokenStore.setUserId(res.user_id);
      navigate({ to: "/" });
    },
  });
}

/**
 * Complete a two-step login: exchange the mfa_token from useLogin plus a TOTP
 * or recovery code for a session. Persists tokens exactly like password login.
 */
export function useCompleteMfaLogin() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (in_: { mfa_token: string; code: string }) =>
      api<SessionResponse>("/v1/auth/mfa", {
        method: "POST",
        body: in_,
        anonymous: true,
      }),

    onSuccess: (pair) => {
      tokenStore.clear();
      tokenStore.set(pair.access_token);
      tokenStore.setRefresh(pair.refresh_token);
      if (pair.tenant_id) {
        tokenStore.setTenantId(pair.tenant_id);
      }
      tokenStore.setUserId(pair.user_id);
      navigate({ to: "/" });
    },
  });
}

/**
 * Accept an organization invite: exchange the emailed token + a chosen password for
 * a session (the backend creates/sets up the user and grants the invited role),
 * then land on the dashboard. Anonymous like login — there's no session yet.
 */
export function useAcceptInvite() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (in_: { token: string; password: string; display_name?: string }) =>
      api<SessionResponse>("/v1/invites/accept", {
        method: "POST",
        body: in_,
        anonymous: true,
      }),

    onSuccess: (pair) => {
      tokenStore.clear();
      tokenStore.set(pair.access_token);
      tokenStore.setRefresh(pair.refresh_token);

      if (pair.tenant_id) {
        tokenStore.setTenantId(pair.tenant_id);
      }

      tokenStore.setUserId(pair.user_id);
      navigate({ to: "/" });
    },
  });
}
/** A pending invitation addressed to the signed-in user's email. */
export interface ReceivedInvite {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  email: string;
  role_id?: string | null;
  expires_at: string;
  created_at: string;
}

/**
 * Pending invitations addressed to the current user's email. Lets an org-less
 * user discover invites in-app instead of depending on the original email link.
 */
export function useMyInvitations() {
  return useQuery({
    queryKey: ["invites", "mine"],
    queryFn: () => api<{ items: ReceivedInvite[] }>("/v1/me/invites"),
  });
}

/**
 * Accept a pending invitation with the *existing* signed-in account (no new
 * user, no password) and switch into the newly-joined organization.
 */
export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (inviteId: string) =>
      api<TokenPair & { tenant_id?: string }>(`/v1/me/invites/${inviteId}/accept`, {
        method: "POST",
        body: {},
      }),
    onSuccess: (pair) => {
      tokenStore.set(pair.access_token);
      tokenStore.setRefresh(pair.refresh_token);
      if (pair.tenant_id) tokenStore.setTenantId(pair.tenant_id);
      if (typeof window !== "undefined") window.location.assign("/");
    },
  });
}

/**
 * Consume a magic-link token and exchange it for a Qeet ID session.
 * Called by the public /magic landing page. On success the access /
 * refresh / tenant / user are persisted exactly like the password
 * login flow, so downstream queries immediately see a Bearer header.
 */
export function useConsumeMagicLink() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (token: string) =>
      api<TokenPair & { tenant_id?: string }>("/v1/auth/magic-link/consume", {
        method: "POST",
        body: { token },
        anonymous: true,
      }),
    onSuccess: (pair) => {
      tokenStore.set(pair.access_token);
      tokenStore.setRefresh(pair.refresh_token);
      if (pair.tenant_id) tokenStore.setTenantId(pair.tenant_id);
      tokenStore.setUserId(pair.user_id);
      navigate({ to: "/" });
    },
    // The /magic page surfaces the error inline; no global toast.
    meta: { silent: true },
  });
}

/**
 * Exchange a one-time SAML login code (delivered to /sso/callback in the URL
 * fragment after a successful assertion) for a Qeet ID session. Persists the
 * tokens exactly like the other login flows.
 */
export function useConsumeSamlCode() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (code: string) =>
      api<TokenPair & { tenant_id?: string }>("/saml/exchange", {
        method: "POST",
        body: { code },
        anonymous: true,
      }),
    onSuccess: (pair) => {
      tokenStore.clear();
      tokenStore.set(pair.access_token);
      tokenStore.setRefresh(pair.refresh_token);
      if (pair.tenant_id) tokenStore.setTenantId(pair.tenant_id);
      tokenStore.setUserId(pair.user_id);
      navigate({ to: "/" });
    },
    meta: { silent: true },
  });
}

/**
 * Kick off a password-reset email. Endpoint returns 200 regardless of
 * whether the email exists (constant-time no-leak design), so the
 * caller can unconditionally show "check your inbox" UX. The mutation
 * is marked silent so failures don't surface a toast — surfacing a
 * "user not found" error would defeat the enumeration-protection
 * design of the endpoint.
 */
export function useForgotPassword() {
  return useMutation({
    // In dev (SERVICE_ENV=dev) the backend returns dev_reset_token so the reset
    // link is usable without a real email provider; prod omits it.
    mutationFn: (in_: { email: string }) =>
      api<{ message: string; dev_reset_token?: string }>("/v1/auth/forgot-password", {
        method: "POST",
        body: in_,
        anonymous: true,
      }),
    meta: { silent: true },
  });
}

/**
 * Complete a password reset: exchange the emailed token + a new password, then
 * send the user to sign-in. Anonymous — there's no session yet.
 */
export function useResetPassword() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (in_: { token: string; new_password: string }) =>
      api<{ message: string }>("/v1/auth/reset-password", {
        method: "POST",
        body: in_,
        anonymous: true,
      }),
    onSuccess: () => navigate({ to: "/sign-in" }),
    meta: { successMessage: "Password reset — sign in with your new password" },
  });
}

type SignupInput = {
  email: string;
  password: string;
  display_name?: string;
};

// Signup is now tenant-less: the response carries the new user + a token pair
// but NO tenant. The user creates their first organization from the dashboard.
export type SignupResponse = TokenPair & {
  user: User;
};

// useSignup persists the new tenant-less session, then either runs a caller
// supplied onSuccess (e.g. to kick off email OTP verification) or, by default,
// navigates straight to the dashboard.
export function useSignup(opts?: { onSuccess?: (res: SignupResponse) => void }) {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (in_: SignupInput) =>
      api<SignupResponse>("/v1/auth/signup", {
        method: "POST",
        body: in_,
        anonymous: true,
      }),
    onSuccess: (res) => {
      // Tenant-less session; clear any stale tenant id first. Tokens are set
      // here so the follow-up email-verification calls are authenticated.
      tokenStore.clear();
      tokenStore.set(res.access_token);
      tokenStore.setRefresh(res.refresh_token);
      tokenStore.setUserId(res.user_id);
      if (opts?.onSuccess) {
        opts.onSuccess(res);
      } else {
        navigate({ to: "/" });
      }
    },
  });
}

// Email OTP verification (self-service, uses the just-issued signup token).
// StartEmail sends a 6-digit code to the address on file; ConfirmEmail marks
// the email verified. Both are backed by /v1/users/{id}/verify/email/*.
export function useStartEmailVerification() {
  return useMutation({
    mutationFn: (userId: string) =>
      api<{ message: string }>(`/v1/users/${userId}/verify/email/start`, {
        method: "POST",
        body: {},
      }),
  });
}

/**
 * Email-change flow: send a code to a *new* address, then confirm it to swap the
 * login email. Backed by `POST /v1/me/email/change/{start,confirm}`.
 */
export function useStartEmailChange() {
  return useMutation({
    mutationFn: (email: string) =>
      api<{ message: string }>("/v1/me/email/change/start", { method: "POST", body: { email } }),
  });
}

export function useConfirmEmailChange() {
  return useMutation({
    mutationFn: (code: string) =>
      api<{ message: string; email: string }>("/v1/me/email/change/confirm", {
        method: "POST",
        body: { code },
      }),
  });
}

/**
 * Change the signed-in user's password by re-proving the current one. Backed by
 * `POST /v1/auth/password`; tenant-independent, so it works before any org.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: (in_: { current_password: string; new_password: string }) =>
      api<{ message: string }>("/v1/auth/password", { method: "POST", body: in_ }),
  });
}

export function useConfirmEmailVerification() {
  return useMutation({
    mutationFn: (in_: { userId: string; code: string }) =>
      api<{ message: string }>(`/v1/users/${in_.userId}/verify/email/confirm`, {
        method: "POST",
        body: { code: in_.code },
      }),
  });
}

// Switch organization: mint a token scoped to a tenant the user belongs to, persist it, reload.
export async function switchToTenant(tenantId: string): Promise<void> {
  const res = await api<TokenPair & { tenant_id: string }>("/v1/auth/switch-tenant", {
    method: "POST",
    body: { tenant_id: tenantId },
  });
  tokenStore.set(res.access_token);
  tokenStore.setRefresh(res.refresh_token);
  tokenStore.setTenantId(res.tenant_id);
  if (typeof window !== "undefined") window.location.assign("/");
}

// ---------------------------------------------------------------------------
// Platform social login (the console's own Qeet ID accounts, tenant-less)
// ---------------------------------------------------------------------------

/** Which platform-level social providers are configured (e.g. ["google"]). */
export function usePlatformSocialProviders() {
  return useQuery({
    queryKey: ["social", "platform-providers"],
    queryFn: () =>
      api<{ providers: string[] }>("/v1/social/platform/providers", { anonymous: true }),
    staleTime: 5 * 60_000,
  });
}

/** Full backend URL to begin a platform social login (browser redirect). */
export function socialStartUrl(provider: string): string {
  return `${API_BASE_URL}/v1/social/${provider}/start`;
}

/**
 * Begin linking a social provider to the *current* signed-in account. Unlike
 * login, this is authenticated: the server stashes our identity in the OAuth
 * state (so the callback attaches the provider to us, never creating/switching
 * an account) and returns the provider authorize URL to hand the browser to.
 * The provider callback returns to /account/security.
 */
export async function startSocialLink(provider: string): Promise<void> {
  const res = await api<{ authorize_url: string }>(`/v1/social/${provider}/link/start`, {
    method: "POST",
    body: {},
  });
  if (typeof window !== "undefined" && res.authorize_url) {
    window.location.href = res.authorize_url;
  }
}

/**
 * Trade the one-time social login code (delivered to /sign-in?social_code=…
 * after the provider redirect) for a Qeet session. Tenant-less, like signup —
 * the user creates their first organization from the dashboard.
 */
export function useConsumeSocialCode() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (code: string) =>
      api<TokenPair & { tenant_id?: string }>("/v1/social/exchange", {
        method: "POST",
        body: { code },
        anonymous: true,
      }),
    onSuccess: (pair) => {
      tokenStore.clear();
      tokenStore.set(pair.access_token);
      tokenStore.setRefresh(pair.refresh_token);
      if (pair.tenant_id) tokenStore.setTenantId(pair.tenant_id);
      tokenStore.setUserId(pair.user_id);
      navigate({ to: "/" });
    },
    meta: { silent: true },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/v1/auth/logout", { method: "POST" }).catch(() => undefined),
    onSettled: () => {
      tokenStore.clear();
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
  return useSyncExternalStore(tokenStore.subscribe, tokenStore.getTenantId, () => null);
}

/** Whether the user has a stored access token. Read synchronously for guards. */
export function isAuthenticated(): boolean {
  return !!tokenStore.get();
}

// ---------------------------------------------------------------------------
// JWT introspection
//
// We never trust the JWT payload for authorization decisions (the server
// re-validates on every request). We DO read it client-side to drive
// UX-only signals — e.g. the impersonation banner, which checks for the
// RFC 8693 `act` claim and surfaces who the admin is acting as.
// ---------------------------------------------------------------------------

function base64UrlDecode(s: string): string {
  let b = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  try {
    return atob(b);
  } catch {
    return "";
  }
}

interface AccessClaims {
  /** RFC 8693 actor claim — present iff this token was issued by an
   *  impersonation grant. `sub` identifies the admin doing the acting. */
  act?: {
    sub?: string;
    email?: string;
    display_name?: string;
  };
  sub?: string;
  email?: string;
  tenant_id?: string;
  exp?: number;
  [k: string]: unknown;
}

function decodeAccessToken(): AccessClaims | null {
  const raw = tokenStore.get();
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const payload = base64UrlDecode(parts[1]);
  if (!payload) return null;
  try {
    return JSON.parse(payload) as AccessClaims;
  } catch {
    return null;
  }
}

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
  const claims = decodeAccessToken();
  if (!claims?.act?.sub || !claims.sub) return null;
  return {
    targetSubject: claims.sub,
    actorSubject: claims.act.sub,
    actorEmail: claims.act.email,
    actorDisplayName: claims.act.display_name,
  };
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
 * Fetch the current user via `GET /v1/users/{user_id}` using the user_id
 * persisted at login/signup time. We don't have a `GET /v1/users/me`
 * endpoint yet — this round-trip is one extra request but lets us show
 * the real email + display name in the header without re-issuing JWTs.
 */
export function useMe() {
  const userId = tokenStore.getUserId();
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
