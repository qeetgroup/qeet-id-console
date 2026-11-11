import { useNavigate } from "@tanstack/react-router";
import { Spinner, Text } from "@qeetrix/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { passkeyErrorMessage, startPasskeyAutofill, usePasskeyLogin } from "../api/passkey-flows";
import { EntryPanel, useEntrySteps } from "./entry-panel";
import { EntryShell } from "./entry-shell";
import { LazyMfaChallengeStep, preloadMfaChallengeStep } from "./lazy-mfa-challenge-step";
import { LoginForm } from "./signin-form";
import { isMfaChallenge, useConsumeSocialCode, useLogin } from "@/modules/authentication";
import { errorMessage } from "@/platform/errors/user-message";
import { isOneOf } from "@/shared/utils/one-of";

// Why a social sign-in came back refused (`?social_error=…`), and what to say about it.
const SOCIAL_ERRORS = {
  // Sign-in never creates an account: sign up first.
  no_account: "signIn.noSocialAccount",
  // An account uses the address, but nobody has proved owning it, so the provider's word
  // doesn't hand it over.
  account_unverified: "signIn.socialAccountUnverified",
  // A suspended or deleted account isn't signed in by any method.
  account_inactive: "signIn.socialAccountInactive",
  // Begun in another browser: start again here.
  other_browser: "signIn.socialOtherBrowser",
} as const;
const SOCIAL_ERROR_REASONS = Object.keys(SOCIAL_ERRORS) as (keyof typeof SOCIAL_ERRORS)[];

/** Renders sign-in: email first, then SSO, password or passkey (with autofill), and social return. */
export function SignInPage() {
  const { t } = useTranslation("auth-flow");
  const steps = useEntrySteps();
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

  // Back from a social sign-in the provider completed but we refused: say why, then strip the
  // param so a reload won't toast again.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("social_error") ?? "";
    if (!isOneOf(SOCIAL_ERROR_REASONS, reason)) return;
    toast.error(t(SOCIAL_ERRORS[reason]));
    window.history.replaceState({}, "", window.location.pathname);
  }, [t]);

  // Back from a password reset: confirm it on the page, then strip the param so a reload won't.
  const [resetDone, setResetDone] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reset") !== "done") return;
    setResetDone(true);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  // After a correct password, or a social sign-in, an account that holds or must have a second
  // factor gets a challenge instead of tokens: the second-factor step, or setting up an
  // authenticator app.
  const challenge =
    (login.data && isMfaChallenge(login.data) ? login.data : null) ??
    (social.data && isMfaChallenge(social.data) ? social.data : null);
  if (challenge) {
    return <LazyMfaChallengeStep challenge={challenge} />;
  }

  return (
    <EntryShell panel={<EntryPanel steps={steps.signIn} />}>
      {socialCode ? (
        <div className="entry-waiting" role="status">
          <Spinner size="lg" />
          <Text tone="subtle">
            {social.isError ? errorMessage(social.error) : t("signIn.socialSigningIn")}
          </Text>
        </div>
      ) : (
        <LoginForm
          isLoading={login.isPending}
          isPasskeyLoading={passkey.isPending}
          resetDone={resetDone}
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
            preloadMfaChallengeStep();
            login.mutate(values);
          }}
          onPasskeyLogin={() => {
            stopAutofill.current();
            setAutofillError(null);
            login.reset();
            passkey.mutate();
          }}
        />
      )}
    </EntryShell>
  );
}
