import { useNavigate } from "@tanstack/react-router";
import { Spinner, Text } from "@qeetrix/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { passkeyErrorMessage, startPasskeyAutofill, usePasskeyLogin } from "../api/passkey-flows";
import { AuthShell } from "./auth-shell";
import { EntryPanel, useEntrySteps } from "./entry-panel";
import { EntryShell } from "./entry-shell";
import { LoginForm } from "./signin-form";
import {
  isMfaChallenge,
  MfaChallengeStep,
  useConsumeSocialCode,
  useLogin,
} from "@/modules/authentication";
import { errorMessage } from "@/platform/errors/user-message";

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

  // Back from a social sign-in with no matching account: sign-in never creates one, so say to
  // sign up first, then strip the param so a reload won't toast again.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("social_error") !== "no_account") return;
    toast.error(t("signIn.noSocialAccount"));
    window.history.replaceState({}, "", window.location.pathname);
  }, [t]);

  // Back from a password reset: confirm it on the page, then strip the param so a reload won't.
  const [resetDone, setResetDone] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reset") !== "done") return;
    setResetDone(true);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  // After a correct password, an account that holds or must have a second factor gets a
  // challenge instead of tokens: the second-factor step, or setting up an authenticator app.
  // That step keeps its current frame until its own redesign.
  const challenge = login.data && isMfaChallenge(login.data) ? login.data : null;
  if (challenge) {
    return (
      <AuthShell intent="signin">
        <MfaChallengeStep challenge={challenge} />
      </AuthShell>
    );
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
