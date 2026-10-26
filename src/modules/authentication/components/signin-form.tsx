import { ArrowRightIcon, BuildingIcon, FingerprintPatternIcon, MailIcon } from "@qeetrix/icons";
import { Avatar, Button, Field, Heading, Link, Text, TextField } from "@qeetrix/react";
import { Alert, Form, PasswordInput } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSSODiscovery } from "../api/sso";

import { EntryConsent, EntryOr } from "./entry-shell";
import { ProviderButtons } from "./provider-buttons";

export type LoginFormValues = {
  email: string;
  password: string;
};

type LoginFormProps = {
  isLoading?: boolean;
  isPasskeyLoading?: boolean;
  errorMessage?: string;
  /** Back from a password reset: say the new password is in place. */
  resetDone?: boolean;
  onLogin?: (values: LoginFormValues) => void;
  onPasskeyLogin?: () => void;
};

/**
 * Sign-in, email first: the work email decides the way in. A domain with single sign-on goes to
 * its identity provider; anyone else gets the password step, with a passkey a tap away throughout.
 */
export function LoginForm({
  isLoading = false,
  isPasskeyLoading = false,
  errorMessage,
  resetDone = false,
  onLogin,
  onPasskeyLogin,
}: LoginFormProps) {
  const { t } = useTranslation("auth-flow");
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Debounce the email that drives SSO discovery, so typing isn't a request per keystroke.
  const [lookup, setLookup] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setLookup(email.trim()), 350);
    return () => clearTimeout(timer);
  }, [email]);
  const sso = useSSODiscovery(lookup);
  const ssoHit = lookup === email.trim() ? sso.data : null;

  // Continue waits for the lookup of exactly this email, so a fast Enter can't skip an SSO domain.
  const [continuing, setContinuing] = useState(false);
  useEffect(() => {
    if (!continuing || lookup !== email.trim() || sso.isFetching) return;
    setContinuing(false);
    if (sso.data) window.location.href = sso.data.redirect_url;
    else setStep("password");
  }, [continuing, lookup, email, sso.isFetching, sso.data]);

  const isBusy = isLoading || isPasskeyLoading || continuing;
  const isDisabled = !hydrated || isBusy;

  const failure = errorMessage ? (
    <Alert tone="danger" title={t("signIn.failedTitle")} announce="urgent">
      {errorMessage}
    </Alert>
  ) : null;

  if (step === "password") {
    return (
      <PasswordStep
        email={email.trim()}
        failure={failure}
        isLoading={isLoading}
        isPasskeyLoading={isPasskeyLoading}
        isDisabled={isDisabled}
        onBack={() => setStep("email")}
        onLogin={(password) => onLogin?.({ email: email.trim(), password })}
        onPasskeyLogin={onPasskeyLogin}
      />
    );
  }

  return (
    <>
      <div className="entry-heading">
        <Heading level={1} size="display-sm">
          {t("signIn.title")}
        </Heading>
        <Text tone="subtle" size="lg">
          {t("signIn.lede")}
        </Text>
      </div>

      {resetDone && (
        <Alert tone="success" title={t("signIn.resetDoneTitle")} announce="polite">
          {t("signIn.resetDoneText")}
        </Alert>
      )}
      {failure}

      <Form
        aria-label={t("signIn.title")}
        className="entry-form"
        summary={false}
        aria-busy={isBusy}
        onFormSubmit={() => {
          if (isDisabled) return;
          setLookup(email.trim());
          setContinuing(true);
        }}
      >
        <TextField
          label={t("signIn.emailLabel")}
          name="email"
          type="email"
          icon={MailIcon}
          placeholder={t("signIn.emailPlaceholder")}
          autoComplete="username webauthn"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {ssoHit && (
          <Alert
            tone="info"
            icon={BuildingIcon}
            title={t("signIn.ssoTitle", { provider: ssoHit.provider_name })}
          >
            {t("signIn.ssoText")}
          </Alert>
        )}
        <Button
          type="submit"
          size="lg"
          fullWidth
          icon={ArrowRightIcon}
          loading={continuing}
          disabled={isDisabled}
        >
          {ssoHit
            ? t("form.ssoContinue", { provider: ssoHit.provider_name })
            : t("signIn.continue")}
        </Button>
      </Form>

      {/* An SSO domain signs in only through its identity provider: no passkey or social bypass. */}
      {!ssoHit && (
        <>
          <EntryOr />
          <div className="entry-form">
            <Button
              variant="soft"
              size="lg"
              fullWidth
              icon={FingerprintPatternIcon}
              loading={isPasskeyLoading}
              disabled={isDisabled || !onPasskeyLogin}
              onClick={onPasskeyLogin}
            >
              {t("signIn.passkey")}
            </Button>
            <ProviderButtons action="signIn" disabled={isDisabled} />
          </div>
        </>
      )}

      <div className="entry-links">
        <Link render={<RouterLink to="/magic" />}>{t("magic.requestTitle")}</Link>
        <span>
          {t("signIn.newHere")}{" "}
          <Link render={<RouterLink to="/sign-up" />}>{t("signIn.createOrganisation")}</Link>
        </span>
      </div>
      <EntryConsent action="signIn" />
    </>
  );
}

/** The password step: who is signing in, with a way back, and the passkey as the alternative. */
function PasswordStep({
  email,
  failure,
  isLoading,
  isPasskeyLoading,
  isDisabled,
  onBack,
  onLogin,
  onPasskeyLogin,
}: {
  email: string;
  failure: ReactNode;
  isLoading: boolean;
  isPasskeyLoading: boolean;
  isDisabled: boolean;
  onBack: () => void;
  onLogin: (password: string) => void;
  onPasskeyLogin?: () => void;
}) {
  const { t } = useTranslation("auth-flow");
  // Focus the password from an effect, since the a11y lint rule forbids autoFocus.
  const passwordRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  return (
    <>
      <div className="entry-heading">
        <Heading level={1} size="display-sm">
          {t("signIn.welcomeBack")}
        </Heading>
        <Text tone="subtle" size="lg">
          {t("signIn.passwordLede")}
        </Text>
      </div>

      <div className="entry-account">
        <Avatar name={email} size="md" decorative />
        <span className="entry-who">{email}</span>
        <button
          type="button"
          className="entry-text-button"
          aria-label={t("signIn.changeLabel")}
          onClick={onBack}
        >
          {t("signIn.change")}
        </button>
      </div>

      {failure}

      <Form
        aria-label={t("signIn.title")}
        className="entry-form"
        summary={false}
        aria-busy={isLoading || isPasskeyLoading}
        onFormSubmit={(values) => {
          if (isDisabled) return;
          onLogin(String(values.password ?? ""));
        }}
      >
        {/* The account's email, for password managers to save beside the password. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <Field label={t("form.password")} name="password">
          <PasswordInput ref={passwordRef} autoComplete="current-password" required />
        </Field>
        <div className="entry-links">
          <span />
          <Link render={<RouterLink to="/forgot-password" />}>{t("signIn.forgotPassword")}</Link>
        </div>
        <Button
          type="submit"
          size="lg"
          fullWidth
          icon={ArrowRightIcon}
          loading={isLoading}
          disabled={isDisabled}
        >
          {t(isLoading ? "signIn.submitting" : "signIn.submit")}
        </Button>
      </Form>

      <EntryOr />
      <Button
        variant="soft"
        size="lg"
        fullWidth
        icon={FingerprintPatternIcon}
        loading={isPasskeyLoading}
        disabled={isDisabled || !onPasskeyLogin}
        onClick={onPasskeyLogin}
      >
        {t("signIn.passkeyInstead")}
      </Button>
      <EntryConsent action="signIn" />
    </>
  );
}
