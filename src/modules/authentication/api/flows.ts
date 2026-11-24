// Sign-in, magic-link, SSO, recovery and organization-switch flows; sign-up, invitations and social
// sign-in live in the flows-*.ts siblings. The BFF keeps token responses in its encrypted HttpOnly
// session and returns only safe session metadata; session identity lives in @/platform/auth/session.

import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { backend } from "@/platform/api/backend";

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
    mutationFn: async (in_: LoginInput): Promise<LoginResponse> =>
      backend.post("/v1/auth/login", { body: in_, anonymous: true }),

    onSuccess: (res) => {
      // No session yet: the sign-in page renders the second-factor step from this mutation's data.
      if (isMfaChallenge(res)) return;

      void navigate({ to: "/" });
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
    mutationFn: async (
      in_: { mfa_token: string } & MfaProof,
    ): Promise<SessionResponse & { recovery_codes?: string[] }> =>
      backend.post("/v1/auth/mfa", { body: in_, anonymous: true }),

    onSuccess: (res) => {
      if (res.recovery_codes?.length) return;
      void navigate({ to: "/" });
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
      backend.post("/v1/auth/magic-link/start", { body: { email }, anonymous: true }),
    meta: { silent: true },
  });
}

/** Sends a new sign-in link, to the same address, in place of a used or expired one. */
export function useResendMagicLink() {
  return useMutation({
    mutationFn: (token: string) =>
      backend.post("/v1/auth/magic-link/resend", { body: { token }, anonymous: true }),
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
    mutationFn: async (token: string): Promise<LoginResponse> =>
      backend.post("/v1/auth/magic-link/consume", { body: { token }, anonymous: true }),
    onSuccess: (res) => {
      if (isMfaChallenge(res)) return;
      void navigate({ to: "/" });
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
    mutationFn: async (code: string): Promise<SessionResponse> =>
      backend.post("/saml/exchange", { body: { code }, anonymous: true }),
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
    mutationFn: (in_: { email: string }) =>
      backend.post("/v1/auth/forgot-password", { body: in_, anonymous: true }),
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
      backend.post("/v1/auth/reset-password", { body: in_, anonymous: true }),
    onSuccess: () => navigate({ href: "/sign-in?reset=done" }),
    meta: { silentError: true },
  });
}

// The session metadata the BFF passes on once it has kept the new token pair server-side.
// The contract leaves organization_id out of a pair that belongs to no organization; a switch
// must land in one, so an answer without it fails closed.
const switchedOrganizationSchema = z
  .object({ session_id: z.string(), user_id: z.string(), organization_id: z.string().optional() })
  .refine((pair) => !!pair.organization_id);

/** Switches organization: the BFF replaces the encrypted session, then the page reloads. */
export async function switchToOrganization(organizationId: string): Promise<void> {
  await backend.post("/v1/auth/switch-organization", {
    body: { organization_id: organizationId },
    schema: switchedOrganizationSchema,
  });
  if (typeof window !== "undefined") window.location.assign("/");
}
