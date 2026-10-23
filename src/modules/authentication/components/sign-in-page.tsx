import { useNavigate } from "@tanstack/react-router";
import { LoaderCircleIcon } from "@qeetrix/icons";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { passkeyErrorMessage, startPasskeyAutofill, usePasskeyLogin } from "../api/passkey-flows";
import { LoginForm } from "./signin-form";
import {
  isMfaChallenge,
  MfaChallengeStep,
  useConsumeSocialCode,
  useLogin,
} from "@/modules/authentication";
import { errorMessage } from "@/platform/errors/user-message";

/** Renders sign-in: password, passkey (with autofill), SSO discovery and social return. */
export function SignInPage() {
  const login = useLogin();
  const social = useConsumeSocialCode();
  const passkey = usePasskeyLogin();
  const navigate = useNavigate();
  const [autofillError, setAutofillError] = useState<unknown>(null);
  // Offer the user's passkeys in the browser's own prompt as the page loads;
  // stopped before signing in any other way.
  const stopAutofill = useRef<() => void>(() => {});
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("social_code")) return;
    stopAutofill.current = startPasskeyAutofill({
      onSignedIn: () => navigate({ to: "/" }),
      onError: setAutofillError,
    });
    return () => stopAutofill.current();
  }, [navigate]);

  // Returning from a platform social login: the provider callback bounced the
  // browser here with a one-time code to exchange for a session.
  const [socialCode, setSocialCode] = useState<string | null>(null);
  const socialFired = useRef(false);
  useEffect(() => {
    if (socialFired.current) return;
    const code = new URLSearchParams(window.location.search).get("social_code");
    if (!code) return;
    socialFired.current = true;
    setSocialCode(code);
    social.mutate(code);
  }, [social]);

  // Back from a social sign-in with no matching account: sign-in never creates one, so say to
  // sign up first, then strip the param so a reload won't toast again.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("social_error") !== "no_account") return;
    toast.error("No account uses that provider yet. Sign up first, then sign in.");
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  if (socialCode) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
          <LoaderCircleIcon className="size-6 animate-spin" />
          <p className="text-sm">
            {social.isError ? errorMessage(social.error) : "Signing you in…"}
          </p>
        </div>
      </div>
    );
  }

  // After a correct password, an account that holds or must have a second factor gets a
  // challenge instead of tokens: the second-factor step, or setting up an authenticator app.
  const challenge = login.data && isMfaChallenge(login.data) ? login.data : null;
  if (challenge) return <MfaChallengeStep challenge={challenge} />;

  return (
    <LoginForm
      isLoading={login.isPending}
      isPasskeyLoading={passkey.isPending}
      errorMessage={
        passkey.error
          ? passkeyErrorMessage(passkey.error)
          : autofillError
            ? passkeyErrorMessage(autofillError)
            : login.error
              ? errorMessage(login.error)
              : undefined
      }
      onLogin={(values) => {
        stopAutofill.current();
        setAutofillError(null);
        passkey.reset();
        login.mutate(values);
      }}
      onPasskeyLogin={() => {
        stopAutofill.current();
        setAutofillError(null);
        login.reset();
        passkey.mutate();
      }}
    />
  );
}
