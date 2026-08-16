// Auth hooks built on top of api(). The same-origin BFF stores token responses
// in an encrypted HttpOnly session and returns only safe session metadata.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { ApiError, api, API_BASE_URL } from "@/platform/api/client";

type SessionResponse = {
  token_type: string;
  expires_at: string;
  user_id: string;
  session_id: string;
  tenant_id?: string;
};

type User = {
  id: string;
  tenant_id: string;
  email: string;
  display_name?: string | null;
  status: string;
};

type LoginInput = { email: string; password: string };
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
      // A second factor is required — no session is issued yet. The sign-in
      // page reads this mutation's data and renders the code step, completed
      // via useCompleteMfaLogin.
      if (isMfaChallenge(res)) return;

      navigate({ to: "/" });
    },
  });
}

/**
 * Complete a two-step login: exchange the mfa_token from useLogin plus a TOTP
 * or recovery code for a server-owned session.
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

    onSuccess: () => navigate({ to: "/" }),
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

    onSuccess: () => navigate({ to: "/" }),
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
    // Degrade gracefully if the endpoint isn't deployed yet — this renders on the
    // pre-org landing screen, so a 404/501 must not throw a red error toast.
    queryFn: async (): Promise<{ items: ReceivedInvite[] }> => {
      try {
        return await api<{ items: ReceivedInvite[] }>("/v1/me/invites");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
          return { items: [] };
        }
        throw err;
      }
    },
    meta: { silent: true },
    retry: false,
  });
}

/** Decline (dismiss) a pending invitation addressed to me. */
export function useDeclineInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      api<{ message: string }>(`/v1/me/invites/${inviteId}/decline`, { method: "POST", body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites", "mine"] }),
    meta: { silent: true },
  });
}

/**
 * Accept a pending invitation with the *existing* signed-in account (no new
 * user, no password) and switch into the newly-joined organization.
 */
export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (inviteId: string) =>
      api<SessionResponse>(`/v1/me/invites/${inviteId}/accept`, {
        method: "POST",
        body: {},
      }),
    onSuccess: () => {
      if (typeof window !== "undefined") window.location.assign("/");
    },
  });
}

/**
 * Consume a magic-link token and exchange it for a Qeet ID session.
 * Called by the public /magic landing page. The BFF consumes the returned
 * token pair and establishes the HttpOnly session before this resolves.
 */
export function useConsumeMagicLink() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (token: string) =>
      api<SessionResponse>("/v1/auth/magic-link/consume", {
        method: "POST",
        body: { token },
        anonymous: true,
      }),
    onSuccess: () => navigate({ to: "/" }),
    // The /magic page surfaces the error inline; no global toast.
    meta: { silent: true },
  });
}

/**
 * Exchange a one-time SAML login code (delivered to /sso/callback in the URL
 * fragment after a successful assertion) for a Qeet ID session.
 */
export function useConsumeSamlCode() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (code: string) =>
      api<SessionResponse>("/saml/exchange", {
        method: "POST",
        body: { code },
        anonymous: true,
      }),
    onSuccess: () => navigate({ to: "/" }),
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

// Signup is tenant-less. Token material is consumed by the BFF; the user and
// safe session identifiers remain available for the verification step.
export type SignupResponse = SessionResponse & {
  user: User;
};

// useSignup establishes the new tenant-less server session, then either runs a caller
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

/** Whether the current account has a password set (vs social/passkey-only). */
export function usePasswordStatus() {
  return useQuery({
    queryKey: ["auth", "password-status"],
    queryFn: async (): Promise<{ has_password: boolean }> => {
      try {
        return await api<{ has_password: boolean }>("/v1/auth/password");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
          return { has_password: true }; // assume password until proven otherwise
        }
        throw err;
      }
    },
    meta: { silent: true },
    staleTime: 60_000,
  });
}

/**
 * Change (or set) the signed-in user's password. Backed by `POST /v1/auth/password`;
 * `current_password` is only required when the account already has one — a
 * social/passkey account may set one by leaving it empty. Tenant-independent.
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

// Switch organization: the BFF replaces the encrypted session, then reload.
export async function switchToTenant(tenantId: string): Promise<void> {
  await api<SessionResponse & { tenant_id: string }>("/v1/auth/switch-tenant", {
    method: "POST",
    body: { tenant_id: tenantId },
  });
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

/**
 * Full backend URL to begin a platform social ceremony (browser redirect).
 * intent="signup" permits just-in-time account creation; "login" (default)
 * requires an existing account, so signing in never silently creates one.
 */
export function socialStartUrl(provider: string, intent: "login" | "signup" = "login"): string {
  return `${API_BASE_URL}/v1/social/${provider}/start?intent=${intent}`;
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
      api<SessionResponse>("/v1/social/exchange", {
        method: "POST",
        body: { code },
        anonymous: true,
      }),
    onSuccess: () => navigate({ to: "/" }),
    meta: { silent: true },
  });
}

// Session identity lives in @/platform/auth/session (imported directly by
// consumers). This module owns only the pre-login auth *flows*.
