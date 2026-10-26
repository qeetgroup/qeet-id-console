// Sign-in, magic-link, SSO, recovery and organization-switch flows; sign-up, invitations and social
// sign-in live in the flows-*.ts siblings. The BFF keeps token responses in its encrypted HttpOnly
// session and returns only safe session metadata; session identity lives in @/platform/auth/session.

import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { api } from "@/platform/api/client";

import {
  isMfaChallenge,
  type LoginResponse,
  type MfaProof,
  type SessionResponse,
} from "./flows-session";

// Re-exported so callers keep importing every flow from here.
export * from "./flows-account";
export * from "./flows-invitations";
export {
  isMfaChallenge,
  type LoginFactor,
  type MfaChallenge,
  type MfaProof,
} from "./flows-session";
export * from "./flows-social";

type LoginInput = { email: string; password: string };

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
    meta: { successMessage: "authentication:toast.signedInSuccessfully" },
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
    meta: { successMessage: "authentication:toast.signedInSuccessfully" },
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
    meta: { successMessage: "authentication:toast.signedInSuccessfully", silentError: true },
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
    // /sso/callback shows the failure itself, so the global error toast is off.
    meta: { successMessage: "authentication:toast.signedInSuccessfully", silentError: true },
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
 * Completes a password reset with the emailed token and a new password, then opens sign-in, which
 * confirms the change (`?reset=done`). Anonymous: there is no session yet. The reset page shows
 * its own errors, including the expired-link step.
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
    onSuccess: () => navigate({ href: "/sign-in?reset=done" }),
    meta: { silentError: true },
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
