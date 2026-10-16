import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
} from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import i18n from "@/i18n";
import { api, ApiError } from "@/platform/api/client";
import { errorMessage } from "@/platform/errors/user-message";

type PasskeySession = { user_id: string; session_id: string; expires_at: string };

export type PasskeySignupInput = { email: string; display_name: string };

class PasskeyUnsupportedError extends Error {}

function requirePasskeySupport() {
  if (!browserSupportsWebAuthn()) throw new PasskeyUnsupportedError();
}

/** Browser errors get curated copy; backend details never reach the form. */
export function passkeyErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return errorMessage(error);
  if (error instanceof PasskeyUnsupportedError) {
    return i18n.t("passkey.unsupported", { ns: "auth-flow" });
  }
  const isCancelled = error instanceof Error && error.name === "NotAllowedError";
  return i18n.t(isCancelled ? "passkey.cancelled" : "passkey.failed", { ns: "auth-flow" });
}

export async function signInWithPasskey(): Promise<PasskeySession> {
  requirePasskeySupport();
  // Discoverable login lets the device choose the account without requiring email.
  const begin = await api<{
    session_id: string;
    publicKey: PublicKeyCredentialRequestOptionsJSON;
  }>("/v1/passkeys/login/begin", { method: "POST", body: {}, anonymous: true });
  const credential = await startAuthentication({ optionsJSON: begin.publicKey });
  // api() consumes the token response in the BFF, returning safe metadata only.
  return api<PasskeySession>("/v1/passkeys/login/finish", {
    method: "POST",
    body: { session_id: begin.session_id, credential },
    anonymous: true,
  });
}

export async function signUpWithPasskey(input: PasskeySignupInput): Promise<PasskeySession> {
  requirePasskeySupport();
  const begin = await api<{
    session_id: string;
    publicKey: PublicKeyCredentialCreationOptionsJSON;
  }>("/v1/signup/passkey/begin", { method: "POST", body: input, anonymous: true });
  const credential = await startRegistration({ optionsJSON: begin.publicKey });
  return api<PasskeySession>("/v1/signup/passkey/finish", {
    method: "POST",
    body: { session_id: begin.session_id, credential },
    anonymous: true,
  });
}

export type InvitePasskeyInput = { token: string; display_name?: string };

/**
 * Accept an invitation by founding the new account on a passkey. The server
 * takes the email and organisation from the invitation; the token only names it.
 */
export async function acceptInviteWithPasskey(input: InvitePasskeyInput): Promise<PasskeySession> {
  requirePasskeySupport();
  const begin = await api<{
    session_id: string;
    publicKey: PublicKeyCredentialCreationOptionsJSON;
  }>("/v1/invites/accept/passkey/begin", { method: "POST", body: input, anonymous: true });
  const credential = await startRegistration({ optionsJSON: begin.publicKey });
  return api<PasskeySession>("/v1/invites/accept/passkey/finish", {
    method: "POST",
    body: { session_id: begin.session_id, credential },
    anonymous: true,
  });
}

export function useAcceptInviteWithPasskey() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: acceptInviteWithPasskey,
    onSuccess: () => navigate({ to: "/" }),
    meta: { successMessage: "Invitation accepted" },
  });
}

// The server keeps a ceremony for five minutes; renew a little before that.
const AUTOFILL_RENEW_AFTER_MS = 4.5 * 60 * 1000;

/**
 * Passkey sign-in from the browser's own prompt: as the sign-in form loads, a
 * discoverable ceremony starts in the background with conditional mediation,
 * so the browser lists the user's passkeys in the email field's suggestions
 * and picking one signs in with nothing typed. Nothing starts where the
 * browser lacks it. The ceremony is renewed before its server state expires
 * and stopped silently when the user signs in another way (the returned
 * function, or any other passkey ceremony, stops it); a cancelled or replaced
 * ceremony is never reported. A picked passkey the server refuses is.
 */
export function startPasskeyAutofill({
  onSignedIn,
  onError,
}: {
  onSignedIn: (session: PasskeySession) => void;
  onError: (error: unknown) => void;
}): () => void {
  let stopped = false;
  void (async () => {
    if (!(await browserSupportsWebAuthnAutofill().catch(() => false))) return;
    while (!stopped) {
      let renewed = false;
      let renew: ReturnType<typeof setTimeout> | undefined;
      let sessionId: string;
      let credential: Awaited<ReturnType<typeof startAuthentication>>;
      try {
        const begin = await api<{
          session_id: string;
          publicKey: PublicKeyCredentialRequestOptionsJSON;
        }>("/v1/passkeys/login/begin", { method: "POST", body: {}, anonymous: true });
        sessionId = begin.session_id;
        renew = setTimeout(() => {
          renewed = true;
          WebAuthnAbortService.cancelCeremony();
        }, AUTOFILL_RENEW_AFTER_MS);
        credential = await startAuthentication({
          optionsJSON: begin.publicKey,
          useBrowserAutofill: true,
        });
      } catch {
        clearTimeout(renew);
        if (renewed && !stopped) continue;
        return;
      }
      clearTimeout(renew);
      if (stopped) return;
      try {
        const session = await api<PasskeySession>("/v1/passkeys/login/finish", {
          method: "POST",
          body: { session_id: sessionId, credential },
          anonymous: true,
        });
        onSignedIn(session);
        return;
      } catch (err) {
        // The ceremony state ran out while the prompt was open: start again.
        if (err instanceof ApiError && err.code === "auth.session_expired") continue;
        onError(err);
        return;
      }
    }
  })();
  return () => {
    stopped = true;
    WebAuthnAbortService.cancelCeremony();
  };
}

export function usePasskeyLogin() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: signInWithPasskey,
    onSuccess: () => navigate({ to: "/" }),
    meta: { successMessage: "Signed in successfully" },
  });
}

export function usePasskeySignup({
  onSuccess,
}: {
  onSuccess: (session: PasskeySession, input: PasskeySignupInput) => void;
}) {
  return useMutation({
    mutationFn: signUpWithPasskey,
    onSuccess,
    meta: {
      successMessage: "Account created successfully",
      successDescription: "Check your email for the verification code.",
    },
  });
}
