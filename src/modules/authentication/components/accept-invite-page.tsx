import {
  ArrowRightIcon,
  FingerprintPatternIcon,
  LockKeyholeIcon,
  MailIcon,
  UserRoundIcon,
} from "@qeetrix/icons";
import { Button, Field, Heading, Link, Spinner, Text, TextField } from "@qeetrix/react";
import { Alert, Form, PasswordInput } from "@qeetrix/react/experimental";
import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { PublicSession } from "@/platform/auth/server-session";
import { useLogout, useMe } from "@/platform/auth/session";
import { sessionStore } from "@/platform/auth/session-store";
import { ERROR_CODES } from "@/platform/errors/error-codes";
import { errorMessage } from "@/platform/errors/user-message";
import { ApiError } from "@/platform/api/client";
import {
  type InvitePreview,
  useAcceptInvite,
  useAcceptInviteAsMe,
  useInvitePreview,
} from "../api/flows-invitations";
import { passkeyErrorMessage, useAcceptInviteWithPasskey } from "../api/passkey-flows";
import { EntryPanel, useEntrySteps } from "./entry-panel";
import { EntryAccount, EntryConsent, EntryOr, EntryShell } from "./entry-shell";

/**
 * Renders an invitation link, in the entry frame. The invitation is read first: it names the
 * organisation and address, says whether an account holds the address, and which ways a new
 * account may join (a password, a passkey if the organisation allows it). Signed in, the person
 * accepts as that account.
 */
export function AcceptInvitePage({ token, session }: { token: string; session: PublicSession }) {
  const steps = useEntrySteps();
  return (
    // Signed in, there's no way to sign in to choose: what's left is joining.
    <EntryShell
      panel={<EntryPanel steps={steps.invite} current={session.isAuthenticated ? 2 : 1} />}
    >
      <Invitation token={token} session={session} />
    </EntryShell>
  );
}

function Invitation({ token, session }: { token: string; session: PublicSession }) {
  const { t } = useTranslation("auth-flow");
  const preview = useInvitePreview(token);

  if (!token) {
    return <DeadEnd title={t("invite.incompleteTitle")} text={t("invite.incompleteText")} />;
  }
  if (preview.isLoading) {
    return (
      <>
        <Head title={t("invite.checkingTitle")} />
        <div className="entry-status" role="status">
          <Spinner />
          <Text tone="subtle">{t("invite.checking")}</Text>
        </div>
      </>
    );
  }
  if (preview.error || !preview.data) {
    return <DeadEnd title={t("invite.unavailableTitle")} text={errorMessage(preview.error)} />;
  }
  if (session.isAuthenticated)
    return <AcceptAsMe token={token} invite={preview.data} session={session} />;
  if (preview.data.account_exists) return <HasAccount invite={preview.data} />;
  return <Join token={token} invite={preview.data} />;
}

function Head({ title, lede }: { title: string; lede?: ReactNode }) {
  return (
    <div className="entry-heading">
      <Heading level={1} size="display-sm">
        {title}
      </Heading>
      {lede && (
        <Text tone="subtle" size="lg">
          {lede}
        </Text>
      )}
    </div>
  );
}

/** A link that can't be used: what happened, and the way back. */
function DeadEnd({ title, text }: { title: string; text: string }) {
  const { t } = useTranslation("auth-flow");
  const navigate = useNavigate();
  return (
    <>
      <Head title={title} lede={text} />
      <Button
        variant="soft"
        size="lg"
        fullWidth
        icon={ArrowRightIcon}
        onClick={() => void navigate({ to: "/sign-in" })}
      >
        {t("invite.backToSignIn")}
      </Button>
    </>
  );
}

/** The day the invitation stops working, in the reader's language: "2 November". */
function expiryDate(invite: InvitePreview) {
  return new Intl.DateTimeFormat(formatLocale(), { day: "numeric", month: "long" }).format(
    new Date(invite.expires_at),
  );
}

/** A new account for the invited address: a passkey first, a password as the fallback. */
function Join({ token, invite }: { token: string; invite: InvitePreview }) {
  const { t } = useTranslation("auth-flow");
  const accept = useAcceptInvite();
  const withPasskey = useAcceptInviteWithPasskey();
  const date = expiryDate(invite);
  const offersPasskey = invite.methods.passkey;
  const offersPassword = invite.methods.password;
  const [method, setMethod] = useState<"passkey" | "password">(
    offersPasskey ? "passkey" : "password",
  );
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const isAccountExists = (e: unknown) =>
    e instanceof ApiError && e.code === ERROR_CODES.INVITE_ACCOUNT_EXISTS;
  if (isAccountExists(accept.error) || isAccountExists(withPasskey.error)) {
    return <HasAccount invite={invite} />;
  }

  const withPassword = method === "password";
  const busy = accept.isPending || withPasskey.isPending;
  const failure = withPasskey.error
    ? passkeyErrorMessage(withPasskey.error)
    : accept.error
      ? errorMessage(accept.error)
      : undefined;
  const title = t("invite.title", { organization: invite.organization.name });

  return (
    <>
      <Head title={title} lede={t("invite.expires", { date })} />
      {failure && (
        <Alert tone="danger" title={t("invite.failedTitle")} announce="urgent">
          {failure}
        </Alert>
      )}
      <Form
        aria-label={title}
        className="entry-form"
        summary={false}
        aria-busy={busy}
        onFormSubmit={(values) => {
          if (!hydrated || busy) return;
          const display_name = String(values.display_name ?? "").trim() || undefined;
          if (withPassword) {
            withPasskey.reset();
            accept.mutate({ token, password: String(values.password ?? ""), display_name });
          } else {
            accept.reset();
            withPasskey.mutate({ token, display_name });
          }
        }}
      >
        <TextField
          label={t("invite.email")}
          name="email"
          icon={MailIcon}
          value={invite.email}
          readOnly
          description={t("invite.emailHelp")}
        />
        <TextField
          label={t("invite.name")}
          name="display_name"
          icon={UserRoundIcon}
          placeholder={t("invite.namePlaceholder")}
          autoComplete="name"
          optional
        />
        {withPassword && (
          <Field
            label={t("invite.password")}
            name="password"
            description={t("invite.passwordHelp")}
          >
            <PasswordInput autoComplete="new-password" minLength={8} required />
          </Field>
        )}
        <Button
          type="submit"
          size="lg"
          fullWidth
          icon={withPassword ? ArrowRightIcon : FingerprintPatternIcon}
          loading={withPassword ? accept.isPending : withPasskey.isPending}
          disabled={!hydrated || busy}
        >
          {busy
            ? t("invite.joining")
            : withPassword
              ? t("invite.joinPassword")
              : t("invite.joinPasskey")}
        </Button>
      </Form>
      {offersPasskey && offersPassword && (
        <>
          <EntryOr />
          <Button
            variant="soft"
            size="lg"
            fullWidth
            icon={withPassword ? FingerprintPatternIcon : LockKeyholeIcon}
            disabled={!hydrated || busy}
            onClick={() => setMethod(withPassword ? "passkey" : "password")}
          >
            {withPassword ? t("invite.passkeyInstead") : t("invite.passwordInstead")}
          </Button>
        </>
      )}
      <div className="entry-links">
        <Link render={<RouterLink to="/sign-in" />}>{t("invite.backToSignIn")}</Link>
      </div>
      <EntryConsent action="signUp" />
    </>
  );
}

/** The address already has a Qeet ID: signed in, opening the link again accepts it. */
function HasAccount({ invite }: { invite: InvitePreview }) {
  const { t } = useTranslation("auth-flow");
  const navigate = useNavigate();
  return (
    <>
      <Head
        title={t("invite.title", { organization: invite.organization.name })}
        lede={t("invite.existsLede", { email: invite.email })}
      />
      <Alert tone="info" title={t("invite.existsTitle")}>
        {t("invite.existsText")}
      </Alert>
      <Button
        size="lg"
        fullWidth
        icon={ArrowRightIcon}
        onClick={() => void navigate({ to: "/sign-in" })}
      >
        {t("invite.signIn")}
      </Button>
    </>
  );
}

/** Signed in: join the organisation as this account, if the invitation is for its address. */
function AcceptAsMe({
  token,
  invite,
  session,
}: {
  token: string;
  invite: InvitePreview;
  session: PublicSession;
}) {
  const { t } = useTranslation("auth-flow");
  useEffect(() => {
    sessionStore.hydrate(session);
  }, [session]);
  const me = useMe();
  const logout = useLogout();
  const accept = useAcceptInviteAsMe();
  const date = expiryDate(invite);
  const user = me.isError ? undefined : me.data;
  // The server checks the address too; this says so before a click that would fail.
  const otherAddress =
    user !== undefined && user.email.toLowerCase() !== invite.email.toLowerCase();
  const busy = accept.isPending || accept.isSuccess || logout.isPending;

  return (
    <>
      <Head
        title={t("invite.title", { organization: invite.organization.name })}
        lede={t("invite.expiresSignedIn", { date })}
      />
      {user && <EntryAccount user={user} disabled={busy} onSignOut={() => logout.mutate()} />}
      {otherAddress ? (
        <Alert tone="warning" title={t("invite.mismatchTitle", { email: invite.email })}>
          {t("invite.mismatchText")}
        </Alert>
      ) : (
        <>
          {accept.error && (
            <Alert tone="danger" title={t("invite.failedTitle")} announce="urgent">
              {errorMessage(accept.error)}
            </Alert>
          )}
          <Button
            size="lg"
            fullWidth
            icon={ArrowRightIcon}
            loading={busy}
            disabled={me.isPending || busy}
            onClick={() => accept.mutate(token)}
          >
            {busy ? t("invite.accepting") : t("invite.accept")}
          </Button>
        </>
      )}
    </>
  );
}
