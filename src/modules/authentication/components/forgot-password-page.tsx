import { ArrowRightIcon, FingerprintPatternIcon, MailIcon } from "@qeetrix/icons";
import { Button, Field, Heading, Link, Text, TextField } from "@qeetrix/react";
import { Alert, Form, PasswordInput } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { passkeyErrorMessage, usePasskeyLogin } from "../api/passkey-flows";
import { EntryPanel, useEntrySteps } from "./entry-panel";
import { EntryInboxLinks, EntryOr, EntryShell } from "./entry-shell";
import { useForgotPassword, useResetPassword } from "@/modules/authentication";
import { ApiError } from "@/platform/errors/api-error";
import { ERROR_CODES } from "@/platform/errors/error-codes";
import { errorMessage } from "@/platform/errors/user-message";

// A link that can't be used again: say so, and send a new one from the same page.
const DEAD_LINK_CODES: readonly string[] = [
  ERROR_CODES.RECOVERY_LINK_EXPIRED,
  ERROR_CODES.RECOVERY_LINK_USED,
  ERROR_CODES.RESET_LINK_INVALID,
];

// One route, two modes: without ?token= request a reset link; with it, set a new password.
/** Renders the password reset: request a link, then set a new password from it. */
export function ForgotPasswordPage() {
  const steps = useEntrySteps();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  const forgot = useForgotPassword();
  const reset = useResetPassword();
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Always show "sent": a 4xx must not reveal whether the email has an account.
  const request = (email: string) =>
    forgot.mutate({ email }, { onSettled: () => setSentTo(email) });

  const linkDead = reset.error instanceof ApiError && DEAD_LINK_CODES.includes(reset.error.code);

  let content: React.ReactNode;
  let current = 1;
  if (sentTo !== null) {
    content = (
      <SentPanel
        email={sentTo}
        devToken={forgot.data?.dev_reset_token}
        onAgain={() => {
          forgot.reset();
          setSentTo(null);
        }}
      />
    );
  } else if (token && linkDead) {
    content = <ExpiredPanel isPending={forgot.isPending} onRequest={request} />;
  } else if (token) {
    content = (
      <ResetPanel
        isPending={reset.isPending}
        errorMessage={reset.error ? errorMessage(reset.error) : undefined}
        onReset={(password) => reset.mutate({ token, new_password: password })}
      />
    );
  } else {
    current = 0;
    content = <RequestPanel isPending={forgot.isPending} onRequest={request} />;
  }

  return (
    <EntryShell panel={<EntryPanel steps={steps.recovery} current={current} />}>
      {content}
    </EntryShell>
  );
}

function BackToSignIn() {
  const { t } = useTranslation("auth-flow");
  return (
    <div className="entry-links">
      <span>
        {t("forgotPassword.rememberedIt")}{" "}
        <Link render={<RouterLink to="/sign-in" />}>{t("forgotPassword.backToSignIn")}</Link>
      </span>
    </div>
  );
}

/** The work email, focused on arrival; shared by the request and the expired-link steps. */
function EmailForm({
  label,
  submit,
  isPending,
  onRequest,
}: {
  label: string;
  submit: string;
  isPending: boolean;
  onRequest: (email: string) => void;
}) {
  const { t } = useTranslation("auth-flow");
  // Focus the email from an effect, since the a11y lint rule forbids autoFocus.
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  return (
    <Form
      aria-label={label}
      className="entry-form"
      summary={false}
      aria-busy={isPending}
      onFormSubmit={(values) => {
        const email = String(values.email ?? "").trim();
        if (email && !isPending) onRequest(email);
      }}
    >
      <TextField
        ref={emailRef}
        label={t("forgotPassword.emailLabel")}
        name="email"
        type="email"
        icon={MailIcon}
        placeholder={t("forgotPassword.emailPlaceholder")}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
      />
      <Button
        type="submit"
        size="lg"
        fullWidth
        icon={ArrowRightIcon}
        loading={isPending}
        disabled={isPending}
      >
        {isPending ? t("forgotPassword.sendingBtn") : submit}
      </Button>
    </Form>
  );
}

/** Forgot password: the work email; a passkey makes the reset unnecessary. */
function RequestPanel({
  isPending,
  onRequest,
}: {
  isPending: boolean;
  onRequest: (email: string) => void;
}) {
  const { t } = useTranslation("auth-flow");
  const passkey = usePasskeyLogin();

  return (
    <>
      <div className="entry-heading">
        <Heading level={1} size="display-sm">
          {t("forgotPassword.title")}
        </Heading>
        <Text tone="subtle" size="lg">
          {t("forgotPassword.subtitle")}
        </Text>
      </div>
      {passkey.error && (
        <Alert tone="danger" title={t("signIn.failedTitle")} announce="urgent">
          {passkeyErrorMessage(passkey.error)}
        </Alert>
      )}
      <EmailForm
        label={t("forgotPassword.title")}
        submit={t("forgotPassword.sendBtn")}
        isPending={isPending}
        onRequest={onRequest}
      />
      <EntryOr />
      <Button
        variant="soft"
        size="lg"
        fullWidth
        icon={FingerprintPatternIcon}
        loading={passkey.isPending}
        disabled={passkey.isPending || isPending}
        onClick={() => passkey.mutate()}
      >
        {t("forgotPassword.passkeyInstead")}
      </Button>
      <BackToSignIn />
    </>
  );
}

/** Sent: the same words whether or not the account exists, so the page can't find accounts. */
function SentPanel({
  email,
  devToken,
  onAgain,
}: {
  email: string;
  devToken?: string;
  onAgain: () => void;
}) {
  const { t } = useTranslation("auth-flow");
  return (
    <>
      <div className="entry-heading">
        <Heading level={1} size="display-sm">
          {t("forgotPassword.successTitle")}
        </Heading>
        <Text tone="subtle" size="lg">
          <Trans
            t={t}
            i18nKey="forgotPassword.successText"
            values={{ email }}
            components={{ email: <b className="entry-strong" /> }}
          />
        </Text>
      </div>

      {/* Dev only: the backend hands back the token so the reset link works without email. */}
      {devToken ? (
        <Alert
          tone="warning"
          title={t("forgotPassword.devLinkTitle")}
          actions={
            <Link href={`/forgot-password?token=${encodeURIComponent(devToken)}`}>
              {t("forgotPassword.devLinkButton")}
            </Link>
          }
        >
          {t("forgotPassword.devLinkText")}
        </Alert>
      ) : null}

      <EntryInboxLinks />

      <div className="entry-links">
        <span>
          {t("forgotPassword.successResend")}{" "}
          <button type="button" className="entry-text-button" onClick={onAgain}>
            {t("forgotPassword.successResendLink")}
          </button>
        </span>
        <Link render={<RouterLink to="/sign-in" />}>{t("forgotPassword.backToSignIn")}</Link>
      </div>
    </>
  );
}

/** Reset: one new password (its show toggle replaces "confirm"), and what saving it does. */
function ResetPanel({
  isPending,
  errorMessage: failure,
  onReset,
}: {
  isPending: boolean;
  errorMessage?: string;
  onReset: (password: string) => void;
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
          {t("forgotPassword.reset.title")}
        </Heading>
        <Text tone="subtle" size="lg">
          {t("forgotPassword.reset.subtitle")}
        </Text>
      </div>
      {failure && (
        <Alert tone="danger" title={t("forgotPassword.reset.failedTitle")} announce="urgent">
          {failure}
        </Alert>
      )}
      <Form
        aria-label={t("forgotPassword.reset.title")}
        className="entry-form"
        summary={false}
        aria-busy={isPending}
        onFormSubmit={(values) => {
          if (!isPending) onReset(String(values.new_password ?? ""));
        }}
      >
        <Field
          label={t("forgotPassword.reset.passwordLabel")}
          name="new_password"
          description={t("forgotPassword.reset.passwordHelp")}
        >
          <PasswordInput ref={passwordRef} autoComplete="new-password" minLength={8} required />
        </Field>
        <Button
          type="submit"
          size="lg"
          fullWidth
          icon={ArrowRightIcon}
          loading={isPending}
          disabled={isPending}
        >
          {isPending
            ? t("forgotPassword.reset.submittingBtn")
            : t("forgotPassword.reset.submitBtn")}
        </Button>
      </Form>
      <BackToSignIn />
    </>
  );
}

/** The link was used, is older than 60 minutes or isn't real: send a new one from here. */
function ExpiredPanel({
  isPending,
  onRequest,
}: {
  isPending: boolean;
  onRequest: (email: string) => void;
}) {
  const { t } = useTranslation("auth-flow");
  return (
    <>
      <div className="entry-heading">
        <Heading level={1} size="display-sm">
          {t("forgotPassword.reset.title")}
        </Heading>
      </div>
      <Alert tone="danger" title={t("forgotPassword.expired.title")} announce="urgent">
        {t("forgotPassword.expired.text")}
      </Alert>
      <EmailForm
        label={t("forgotPassword.expired.submit")}
        submit={t("forgotPassword.expired.submit")}
        isPending={isPending}
        onRequest={onRequest}
      />
      <BackToSignIn />
    </>
  );
}
