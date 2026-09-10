import {
  browserSupportsWebAuthn,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
  startRegistration,
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

export function usePasskeyLogin() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: signInWithPasskey,
    onSuccess: () => navigate({ to: "/" }),
    meta: { silent: true },
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
    meta: { silent: true },
  });
}
