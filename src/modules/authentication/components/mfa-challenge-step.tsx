import {
  ArrowRightIcon,
  ChevronRightIcon,
  FingerprintPatternIcon,
  KeyRoundIcon,
  MailIcon,
  MessageSquareIcon,
  SmartphoneIcon,
} from "@qeetrix/icons";
import { Button, Field, Heading, Link, Spinner, Text, TextField } from "@qeetrix/react";
import { Alert, Form, OTPInput } from "@qeetrix/react/experimental";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "@/platform/errors/user-message";

import {
  type LoginFactor,
  type MfaChallenge,
  type MfaProof,
  useCompleteMfaLogin,
} from "../api/flows";
import { completeWithPush, mfaPasskeyProof, sendMfaCode } from "../api/mfa-sign-in";
import { EntryPanel, useEntrySteps } from "./entry-panel";
import { EntryOr, EntryShell } from "./entry-shell";
import { MfaEnrollmentStep, RecoveryCodesStep } from "./mfa-enrollment-step";

const CODE_LENGTH = 6;

/**
 * Renders a sign-in's second-factor challenge after a password or magic link, in the entry frame:
 * the factor step or, for an account that must have a second factor and holds none, authenticator
 * setup and then its recovery codes. Completing it opens the console.
 */
export function MfaChallengeStep({ challenge }: { challenge: MfaChallenge }) {
  const steps = useEntrySteps();
  const mfa = useCompleteMfaLogin();
  const navigate = useNavigate();
  const submitError = mfa.error ? errorMessage(mfa.error) : undefined;
  const submit = (proof: MfaProof) => mfa.mutate({ mfa_token: challenge.mfa_token, ...proof });

  // Setting the app up signed the person in: show its recovery codes once.
  const recoveryCodes = mfa.data?.recovery_codes;
  if (recoveryCodes?.length) {
    return (
      <EntryShell panel={<EntryPanel steps={steps.setup} current={2} />}>
        <RecoveryCodesStep codes={recoveryCodes} onContinue={() => navigate({ to: "/" })} />
      </EntryShell>
    );
  }
  if (challenge.enrollment_required) {
    return (
      <EntryShell panel={<EntryPanel steps={steps.setup} current={1} />}>
        <MfaEnrollmentStep
          mfaToken={challenge.mfa_token}
          dueAt={challenge.enrollment_due_at}
          isLoading={mfa.isPending}
          errorMessage={submitError}
          onSubmit={submit}
        />
      </EntryShell>
    );
  }
  return (
    <EntryShell panel={<EntryPanel steps={steps.confirm} current={1} />}>
      <MfaStep
        mfaToken={challenge.mfa_token}
        factors={challenge.factors ?? []}
        isLoading={mfa.isPending}
        errorMessage={submitError}
        onSubmit={submit}
        onSignedIn={() => navigate({ to: "/" })}
      />
    </EntryShell>
  );
}

/**
 * Renders the second-factor step: a 6-slot code (authenticator app, or a code sent by email or
 * SMS), a recovery code in its place, a passkey, and the other ways this person holds as one
 * ruled list: approving on their phone, or a code sent to an address or number.
 */
export function MfaStep({
  mfaToken,
  factors,
  isLoading,
  errorMessage: submitError,
  onSubmit,
  onSignedIn,
}: {
  mfaToken: string;
  factors: LoginFactor[];
  isLoading: boolean;
  errorMessage?: string;
  onSubmit: (proof: MfaProof) => void;
  onSignedIn: () => void;
}) {
  const { t } = useTranslation("auth-flow");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState<"passkey" | "push" | "send" | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const pushAbort = useRef<AbortController | null>(null);
  // Focus the code from an effect, since the a11y lint rule forbids autoFocus. Unmounting also
  // stops waiting for a push approval.
  const codeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    codeRef.current?.querySelector("input")?.focus();
  }, []);
  useEffect(() => () => pushAbort.current?.abort(), []);
  // A refused code clears the field, so the next attempt starts empty.
  useEffect(() => {
    if (submitError) setCode("");
  }, [submitError]);

  const hasAuthenticator = factors.some((f) => f.type === "totp");
  const hasRecovery = factors.some((f) => f.type === "recovery_code");
  const codeFactors = factors.filter((f) => (f.type === "email" || f.type === "sms") && f.id);
  const hasPasskey = factors.some((f) => f.type === "passkey");
  const hasPush = factors.some((f) => f.type === "push");
  // A code goes in the slots when the app makes one or a code can be sent; recovery has its own.
  const takesCode = hasAuthenticator || codeFactors.length > 0 || hasRecovery;
  const busy = isLoading || pending !== null;
  const ready = recovery ? code.trim().length > 0 : code.length === CODE_LENGTH;

  async function run(kind: "passkey" | "push" | "send", fn: () => Promise<void>) {
    setStepError(null);
    setPending(kind);
    try {
      await fn();
    } catch (err) {
      const cancelled =
        err instanceof Error && (err.name === "NotAllowedError" || err.name === "AbortError");
      if (!cancelled) setStepError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <div className="entry-heading">
        <Heading level={1} size="display-sm">
          {t("signIn.mfa.title")}
        </Heading>
        <Text tone="subtle" size="lg">
          {recovery
            ? t("signIn.mfa.recoveryLede")
            : hasAuthenticator
              ? t("signIn.mfa.subtitle")
              : t("signIn.mfa.subtitleAny")}
        </Text>
      </div>

      {submitError ? (
        <Alert tone="danger" title={t("signIn.mfa.failedTitle")} announce="urgent">
          {submitError}
        </Alert>
      ) : stepError ? (
        <Alert tone="danger" title={t("signIn.mfa.stepFailedTitle")} announce="urgent">
          {stepError}
        </Alert>
      ) : sentTo !== null ? (
        <Alert
          tone="success"
          title={t("signIn.mfa.codeSentTitle", { destination: sentTo })}
          announce="polite"
        >
          {t("signIn.mfa.codeSentText")}
        </Alert>
      ) : null}

      {takesCode && (
        <Form
          aria-label={t("signIn.mfa.title")}
          className="entry-form"
          summary={false}
          aria-busy={busy}
          onFormSubmit={() => {
            if (busy || !ready) return;
            setStepError(null);
            onSubmit({ code: code.trim() });
          }}
        >
          <div ref={codeRef}>
            {recovery ? (
              <TextField
                label={t("signIn.mfa.recoveryLabel")}
                name="code"
                icon={KeyRoundIcon}
                placeholder={t("signIn.mfa.recoveryPlaceholder")}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            ) : (
              <Field label={t("signIn.mfa.codeLabel")} name="code" invalid={Boolean(submitError)}>
                <OTPInput
                  length={CODE_LENGTH}
                  groups={[3, 3]}
                  size="lg"
                  autoComplete="one-time-code"
                  value={code}
                  onValueChange={setCode}
                />
              </Field>
            )}
          </div>
          {hasRecovery && (
            <div className="entry-links">
              <span />
              <button
                type="button"
                className="entry-text-button"
                onClick={() => {
                  setRecovery(!recovery);
                  setCode("");
                }}
              >
                {recovery ? t("signIn.mfa.useAuthenticator") : t("signIn.mfa.useRecovery")}
              </button>
            </div>
          )}
          <Button
            type="submit"
            size="lg"
            fullWidth
            icon={ArrowRightIcon}
            loading={isLoading}
            disabled={busy || !ready}
          >
            {isLoading ? t("signIn.mfa.verifyingBtn") : t("signIn.mfa.verifyBtn")}
          </Button>
        </Form>
      )}

      {(hasPasskey || hasPush || codeFactors.length > 0) && (
        <>
          {takesCode && <EntryOr />}
          {hasPasskey && (
            <Button
              variant="soft"
              size="lg"
              fullWidth
              icon={FingerprintPatternIcon}
              loading={pending === "passkey"}
              disabled={busy}
              onClick={() =>
                run("passkey", async () => {
                  onSubmit(await mfaPasskeyProof(mfaToken));
                })
              }
            >
              {t("signIn.mfa.usePasskey")}
            </Button>
          )}
          {(hasPush || codeFactors.length > 0) && (
            <ul className="entry-options" aria-label={t("signIn.mfa.otherWays")}>
              {hasPush && (
                <li>
                  {pending === "push" ? (
                    <div className="entry-option" data-waiting="" role="status">
                      <Spinner size="sm" />
                      <span className="entry-option-text">
                        <strong>{t("signIn.mfa.pushWaitingTitle")}</strong>
                        <small>{t("signIn.mfa.pushWaitingText")}</small>
                      </span>
                      <button
                        type="button"
                        className="entry-text-button"
                        onClick={() => pushAbort.current?.abort()}
                      >
                        {t("signIn.mfa.cancel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="entry-option"
                      disabled={busy}
                      onClick={() =>
                        run("push", async () => {
                          pushAbort.current = new AbortController();
                          if (await completeWithPush(mfaToken, pushAbort.current.signal))
                            onSignedIn();
                        })
                      }
                    >
                      <SmartphoneIcon shape="sharp" size={20} aria-hidden="true" />
                      <span className="entry-option-text">
                        <strong>{t("signIn.mfa.pushTitle")}</strong>
                        <small>{t("signIn.mfa.pushText")}</small>
                      </span>
                      <ChevronRightIcon shape="sharp" size={16} aria-hidden="true" />
                    </button>
                  )}
                </li>
              )}
              {codeFactors.map((factor) => {
                const Icon = factor.type === "sms" ? MessageSquareIcon : MailIcon;
                return (
                  <li key={factor.id}>
                    <button
                      type="button"
                      className="entry-option"
                      disabled={busy}
                      onClick={() =>
                        run("send", async () => {
                          await sendMfaCode(mfaToken, factor.id as string);
                          setRecovery(false);
                          setCode("");
                          setSentTo(factor.destination ?? "");
                          codeRef.current?.querySelector("input")?.focus();
                        })
                      }
                    >
                      <Icon shape="sharp" size={20} aria-hidden="true" />
                      <span className="entry-option-text">
                        <strong>
                          {factor.type === "sms"
                            ? t("signIn.mfa.smsTitle")
                            : t("signIn.mfa.emailTitle")}
                        </strong>
                        <small>{t("signIn.mfa.sendTo", { destination: factor.destination })}</small>
                      </span>
                      <ChevronRightIcon shape="sharp" size={16} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <div className="entry-links">
        {/* A full load: the challenge lives in this page's state, and going back starts over. */}
        <Link href="/sign-in">{t("forgotPassword.backToSignIn")}</Link>
      </div>
    </>
  );
}
