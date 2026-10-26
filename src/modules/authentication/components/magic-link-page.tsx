import { ArrowRightIcon, FingerprintPatternIcon, MailIcon } from "@qeetrix/icons";
import { Button, Heading, Link, Spinner, Text, TextField } from "@qeetrix/react";
import { Alert, Form } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { passkeyErrorMessage, usePasskeyLogin } from "../api/passkey-flows";
import { AuthShell } from "./auth-shell";
import { EntryPanel, useEntrySteps } from "./entry-panel";
import { EntryInboxLinks, EntryOr, EntryShell } from "./entry-shell";
import {
  isMfaChallenge,
  MfaChallengeStep,
  useConsumeMagicLink,
  useRequestMagicLink,
  useResendMagicLink,
} from "@/modules/authentication";
import { ApiError } from "@/platform/api/client";
import { errorMessage } from "@/platform/errors/user-message";

// One route, two modes, like /forgot-password: without ?token= ask for a link; with it, sign in
// with the link, or send a new one to the same address if it no longer works.
/** Renders magic-link sign-in: request a link, or sign in with the one opened. */
export function MagicLinkPage({ token }: { token?: string }) {
  const steps = useEntrySteps();
  const consume = useConsumeMagicLink();
  const resend = useResendMagicLink();
  const request = useRequestMagicLink();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const firedRef = useRef(false); // stops strict mode's second run spending the token
  useEffect(() => {
    if (!token || firedRef.current) return;
    firedRef.current = true;
    consume.mutate(token);
  }, [token, consume]);

  // The link proved the first factor; the account holds a second, or must have one. The link is
  // spent, so this step is the only way on. It keeps its current frame until its own redesign.
  if (consume.data && isMfaChallenge(consume.data)) {
    return (
      <AuthShell intent="signin">
        <MfaChallengeStep challenge={consume.data} />
      </AuthShell>
    );
  }

  let content: React.ReactNode;
  let current = 0;
  if (token) {
    current = consume.isError ? 1 : 2;
    content = <LinkStatus token={token} consume={consume} resend={resend} />;
  } else if (sentTo !== null) {
    current = 1;
    content = (
      <SentPanel
        email={sentTo}
        onAgain={() => {
          request.reset();
          setSentTo(null);
        }}
      />
    );
  } else {
    content = (
      <RequestPanel
        isPending={request.isPending}
        error={request.error}
        onRequest={(email) => request.mutate(email, { onSuccess: () => setSentTo(email) })}
      />
    );
  }

  return (
    <EntryShell panel={<EntryPanel steps={steps.magic} current={current} />}>{content}</EntryShell>
  );
}

function BackToSignIn() {
  const { t } = useTranslation("auth-flow");
  return <Link render={<RouterLink to="/sign-in" />}>{t("magic.backToSignIn")}</Link>;
}

/** Asks for a sign-in link; the answer is the same for any address. */
function RequestPanel({
  isPending,
  error,
  onRequest,
}: {
  isPending: boolean;
  error: unknown;
  onRequest: (email: string) => void;
}) {
  const { t } = useTranslation("auth-flow");
  const passkey = usePasskeyLogin();
  // Focus the email from an effect, since the a11y lint rule forbids autoFocus.
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  return (
    <>
      <div className="entry-heading">
        <Heading level={1} size="display-sm">
          {t("magic.requestTitle")}
        </Heading>
        <Text tone="subtle" size="lg">
          {t("magic.requestText")}
        </Text>
      </div>
      {error ? (
        <Alert tone="danger" title={t("magic.failedTitle")} announce="urgent">
          {errorMessage(error)}
        </Alert>
      ) : passkey.error ? (
        <Alert tone="danger" title={t("signIn.failedTitle")} announce="urgent">
          {passkeyErrorMessage(passkey.error)}
        </Alert>
      ) : null}
      <Form
        aria-label={t("magic.requestTitle")}
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
          label={t("magic.emailLabel")}
          name="email"
          type="email"
          icon={MailIcon}
          placeholder={t("magic.emailPlaceholder")}
          autoComplete="email"
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
          {t("magic.requestBtn")}
        </Button>
      </Form>
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
        {t("magic.passkeyInstead")}
      </Button>
      <div className="entry-links">
        <BackToSignIn />
      </div>
    </>
  );
}

/** Sent: the same words for any address, so the page can't be used to find accounts. */
function SentPanel({ email, onAgain }: { email: string; onAgain: () => void }) {
  const { t } = useTranslation("auth-flow");
  return (
    <>
      <div className="entry-heading">
        <Heading level={1} size="display-sm">
          {t("magic.sentTitle")}
        </Heading>
        <Text tone="subtle" size="lg">
          <Trans
            t={t}
            i18nKey="magic.sentText"
            values={{ email }}
            components={{ email: <b className="entry-strong" /> }}
          />
        </Text>
      </div>
      <EntryInboxLinks />
      <div className="entry-links">
        <span>
          {t("magic.didntGet")}{" "}
          <button type="button" className="entry-text-button" onClick={onAgain}>
            {t("magic.sendAgain")}
          </button>
        </span>
        <BackToSignIn />
      </div>
    </>
  );
}

/** Signing in with the opened link: waiting, done, or a link that no longer works. */
function LinkStatus({
  token,
  consume,
  resend,
}: {
  token: string;
  consume: ReturnType<typeof useConsumeMagicLink>;
  resend: ReturnType<typeof useResendMagicLink>;
}) {
  const { t } = useTranslation("auth-flow");

  if (consume.isPending || consume.isIdle || consume.isSuccess) {
    const done = consume.isSuccess;
    return (
      <div className="entry-heading" role="status">
        <Spinner size="lg" />
        <Heading level={1} size="display-sm">
          {done ? t("magic.successTitle") : t("magic.loadingTitle")}
        </Heading>
        <Text tone="subtle" size="lg">
          {done ? t("magic.successText") : t("magic.loadingText")}
        </Text>
      </div>
    );
  }

  // An expired or used link (400) gets its own, actionable copy.
  const expired = consume.error instanceof ApiError && consume.error.status === 400;

  return (
    <>
      <div className="entry-heading">
        <Heading level={1} size="display-sm">
          {expired ? t("magic.expiredTitle") : t("magic.errorTitle")}
        </Heading>
        <Text tone="subtle" size="lg">
          {expired ? t("magic.expiredText") : errorMessage(consume.error)}
        </Text>
      </div>
      {resend.isSuccess && (
        <Alert tone="success" title={t("magic.resentTitle")} announce="polite">
          {t("magic.resentText")}
        </Alert>
      )}
      {resend.isSuccess ? (
        <EntryInboxLinks />
      ) : (
        <Button
          size="lg"
          fullWidth
          icon={ArrowRightIcon}
          loading={resend.isPending}
          disabled={resend.isPending}
          onClick={() => resend.mutate(token)}
        >
          {t("magic.sendNewLink")}
        </Button>
      )}
      <div className="entry-links">
        <BackToSignIn />
      </div>
    </>
  );
}
