// Sign-in, sign-up, invitation and recovery flows. The BFF keeps token responses in its encrypted
// HttpOnly session and returns only safe session metadata; session identity lives in
// @/platform/auth/session.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { ApiError, api, getApiBaseUrl } from "@/platform/api/client";

import { refreshSignInMethods } from "./sign-in-methods";
import { authKeys } from "./keys";

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
/**
 * What /v1/auth/login returns instead of a session when the account holds, or must have, a
 * second factor; complete it at /v1/auth/mfa.
 */
export type MfaChallenge = {
  mfa_required: true;
  mfa_token: string;
  methods: string[];
  factors?: LoginFactor[]; // Exactly the second factors this person can complete the challenge with
  /**
   * The account must have a second factor and holds none: set up an authenticator app
   * (startMfaEnrollment) and complete with a code from it.
   */
  enrollment_required?: boolean;
  /** When the organisation's grace period ends; until then the setup can be skipped. */
  enrollment_due_at?: string;
};

/** One way to complete a sign-in's second-factor challenge. */
export type LoginFactor = {
  type: "totp" | "recovery_code" | "email" | "sms" | "passkey" | "push";
  id?: string; // An email or SMS factor's id, to send it a code
  destination?: string; // An email or SMS factor's masked address or number
};

/**
 * How a challenge is completed: a code, a passkey assertion, an approved push or, for an
 * enrolment challenge in its grace period, a skip.
 */
export type MfaProof =
  | { code: string }
  | { passkey: { session_id: string; credential: unknown } }
  | { push: true }
  | { skip: true };
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
      // No session yet: the sign-in page renders the second-factor step from this mutation's data.
      if (isMfaChallenge(res)) return;

      navigate({ to: "/" });
    },
    meta: { successMessage: "Signed in successfully" },
  });
}

/**
 * Exchanges the mfa_token from useLogin plus a proof for a server-owned session. When the proof
 * set up an authenticator app, the response carries its new recovery codes and navigation waits
 * so the sign-in page can show them once.
 */
export function useCompleteMfaLogin() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (in_: { mfa_token: string } & MfaProof) =>
      api<SessionResponse & { recovery_codes?: string[] }>("/v1/auth/mfa", {
        method: "POST",
        body: in_,
        anonymous: true,
      }),

    onSuccess: (res) => {
      if (res.recovery_codes?.length) return;
      navigate({ to: "/" });
    },
    meta: { successMessage: "Signed in successfully" },
  });
}

/**
 * Accepts an organization invite anonymously: exchanges the emailed token and a chosen password
 * for a session (the backend creates the user and grants the invited role), then opens the
 * dashboard.
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
    meta: { successMessage: "Invitation accepted" },
  });
}
/** What an invitation link names, before the invitee chooses how to accept. */
export interface InvitePreview {
  organization: { name: string; slug: string };
  email: string;
  expires_at: string;
  account_exists: boolean; // An account already holds the address: sign in and accept as yourself
  methods: { password: boolean; passkey: boolean }; // The ways a new account may accept
}

/** Looks up an invitation by its emailed token, sent in the body rather than the URL. */
export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: authKeys.invitePreview(token),
    queryFn: () =>
      api<InvitePreview>("/v1/invites/lookup", {
        method: "POST",
        body: { token },
        anonymous: true,
      }),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
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
 * Returns pending invitations addressed to the current user's email, so a user with no
 * organization can find them in-app rather than only through the email link.
 */
export function useMyInvitations() {
  return useQuery({
    queryKey: authKeys.invitations(),
    // A server without this endpoint (404/501) yields no invites: this renders on the pre-org
    // landing screen, where an error toast would be noise.
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

/** Declines a pending invitation addressed to the current user. */
export function useDeclineInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      api<{ message: string }>(`/v1/me/invites/${inviteId}/decline`, { method: "POST", body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.invitations() }),
    meta: { successMessage: "Invitation declined" },
  });
}

/**
 * Accepts a pending invitation as the *existing* signed-in account (no new user or password),
 * then reloads into the joined organization.
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
    meta: { successMessage: "Invitation accepted" },
  });
}

/**
 * Requests a one-time sign-in link for an address. The server answers the same whether or not
 * the address has an account.
 */
export function useRequestMagicLink() {
  return useMutation({
    mutationFn: (email: string) =>
      api<{ message: string }>("/v1/auth/magic-link/start", {
        method: "POST",
        body: { email },
        anonymous: true,
      }),
    meta: { silent: true },
  });
}

/** Sends a new sign-in link, to the same address, in place of a used or expired one. */
export function useResendMagicLink() {
  return useMutation({
    mutationFn: (token: string) =>
      api<{ message: string }>("/v1/auth/magic-link/resend", {
        method: "POST",
        body: { token },
        anonymous: true,
      }),
    meta: { silent: true },
  });
}

/**
 * Exchanges a magic-link token for a session; the BFF stores the token pair in the HttpOnly
 * session before this resolves. An account that holds, or must have, a second factor gets an
 * MFA challenge instead, completed like a password sign-in's.
 */
export function useConsumeMagicLink() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (token: string) =>
      api<LoginResponse>("/v1/auth/magic-link/consume", {
        method: "POST",
        body: { token },
        anonymous: true,
      }),
    onSuccess: (res) => {
      if (isMfaChallenge(res)) return;
      navigate({ to: "/" });
    },
    // The /magic page renders the failure inline, so the global error toast is off.
    meta: { successMessage: "Signed in successfully", silentError: true },
  });
}

/**
 * Exchanges a one-time SAML login code (delivered to /sso/callback in the URL fragment after a
 * successful assertion) for a Qeet ID session.
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
    meta: { successMessage: "Signed in successfully" },
  });
}

/**
 * Requests a password-reset email. The endpoint answers 200 whether or not the address exists,
 * and the mutation is silent, so the page always shows "check your inbox": a "user not found"
 * error would reveal which addresses have accounts.
 */
export function useForgotPassword() {
  return useMutation({
    // Only a dev backend returns dev_reset_token, so a reset works without an email provider.
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
 * Completes a password reset with the emailed token and a new password, then opens sign-in.
 * Anonymous: there is no session yet.
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

/**
 * A tenant-less sign-up's result. The BFF keeps the tokens; the user and safe session ids remain
 * for the email verification step.
 */
export type SignupResponse = SessionResponse & {
  user: User;
};

/**
 * Signs up into a new tenant-less server session, then runs `opts.onSuccess` if given (e.g. to
 * start email verification) or opens the dashboard.
 */
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
    meta: {
      successMessage: "Account created successfully",
      successDescription: "Check your email for the verification code.",
    },
  });
}

/** Sends a code to the user's address on file; useConfirmEmailVerification checks it. */
export function useStartEmailVerification() {
  return useMutation({
    mutationFn: (userId: string) =>
      api<{ message: string }>(`/v1/users/${userId}/verify/email/start`, {
        method: "POST",
        body: {},
      }),
    meta: { successMessage: "Verification code sent to your email", silentError: true },
  });
}

/**
 * Sends a code to a *new* address; confirming it with useConfirmEmailChange makes it the sign-in
 * email.
 */
export function useStartEmailChange() {
  return useMutation({
    mutationFn: (email: string) =>
      api<{ message: string }>("/v1/me/email/change/start", { method: "POST", body: { email } }),
    meta: { successMessage: "Verification code sent to your new address", silentError: true },
  });
}

export function useConfirmEmailChange() {
  return useMutation({
    mutationFn: (code: string) =>
      api<{ message: string; email: string }>("/v1/me/email/change/confirm", {
        method: "POST",
        body: { code },
      }),
    meta: { successMessage: "Email address updated", silentError: true },
  });
}

/** Returns whether the current account has a password (rather than social or passkey only). */
export function usePasswordStatus() {
  return useQuery({
    queryKey: authKeys.passwordStatus(),
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
 * Changes or sets the signed-in user's password. `current_password` is required only when the
 * account has one; a social or passkey account sets a first password by leaving it empty.
 */
export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (in_: { current_password: string; new_password: string }) =>
      api<{ message: string }>("/v1/auth/password", { method: "POST", body: in_ }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: authKeys.passwordStatus() });
      return refreshSignInMethods(qc); // setting a first password adds a way to sign in
    },
    meta: { silent: true }, // the page words the outcome: changed, or set for the first time
  });
}

export function useConfirmEmailVerification() {
  return useMutation({
    mutationFn: (in_: { userId: string; code: string }) =>
      api<{ message: string }>(`/v1/users/${in_.userId}/verify/email/confirm`, {
        method: "POST",
        body: { code: in_.code },
      }),
    meta: { successMessage: "Email verified", silentError: true },
  });
}

// The session metadata the BFF passes on once it has kept the new token pair server-side.
const switchedTenantSchema = z.object({
  session_id: z.string(),
  user_id: z.string(),
  tenant_id: z.string(),
});

/** Switches organization: the BFF replaces the encrypted session, then the page reloads. */
export async function switchToTenant(tenantId: string): Promise<void> {
  await api("/v1/auth/switch-tenant", {
    method: "POST",
    body: { tenant_id: tenantId },
    schema: switchedTenantSchema,
  });
  if (typeof window !== "undefined") window.location.assign("/");
}

// Platform social sign-in: the console's own Qeet ID accounts, tenant-less.

/** Returns which platform-level social providers are configured (e.g. ["google"]). */
export function usePlatformSocialProviders() {
  return useQuery({
    queryKey: authKeys.platformSocialProviders(),
    queryFn: () =>
      api<{ providers: string[] }>("/v1/social/platform/providers", { anonymous: true }),
    staleTime: 5 * 60_000,
  });
}

/**
 * Returns the backend URL that starts a platform social sign-in (a browser redirect).
 * intent="signup" may create an account; "login" requires an existing one, so signing in never
 * silently creates an account.
 */
export function socialStartUrl(provider: string, intent: "login" | "signup" = "login"): string {
  return `${getApiBaseUrl()}/v1/social/${provider}/start?intent=${intent}`;
}

/**
 * Starts linking a social provider to the signed-in account and redirects to the provider. The
 * request is authenticated, so the server keeps our identity in the OAuth state and the callback
 * attaches the provider to this account, never creating or switching one.
 */
export function useStartSocialLink() {
  return useMutation({
    mutationFn: (provider: string) =>
      api<{ authorize_url: string }>(`/v1/social/${provider}/link/start`, {
        method: "POST",
        body: {},
      }),
    onSuccess: (res) => {
      if (typeof window !== "undefined" && res.authorize_url) {
        window.location.href = res.authorize_url;
      }
    },
    meta: { silent: true }, // success leaves the page; a failure toasts from the page
  });
}

/**
 * Exchanges the one-time social login code (delivered to /sign-in?social_code=… after the
 * provider redirect) for a tenant-less session, like sign-up's.
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
    meta: { successMessage: "Signed in successfully" },
  });
}
