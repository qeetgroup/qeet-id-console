import {
  Button,
  Card,
  CardContent,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from "@qeetrix/ui";
import { useNavigate } from "@tanstack/react-router";
import { LoaderCircleIcon } from "@qeetrix/icons";
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
import { MfaEnrollmentStep, RecoveryCodesStep } from "./mfa-enrollment-step";

/**
 * Renders a sign-in's second-factor challenge after a password or magic link: the factor step or,
 * for an account that must have a second factor and holds none, authenticator setup and then its
 * recovery codes. Completing it opens the console.
 */
export function MfaChallengeStep({ challenge }: { challenge: MfaChallenge }) {
  const mfa = useCompleteMfaLogin();
  const navigate = useNavigate();
  const submitError = mfa.error ? errorMessage(mfa.error) : undefined;
  const submit = (proof: MfaProof) => mfa.mutate({ mfa_token: challenge.mfa_token, ...proof });

  // Setting the app up signed the person in: show its recovery codes once.
  const recoveryCodes = mfa.data?.recovery_codes;
  if (recoveryCodes?.length) {
    return <RecoveryCodesStep codes={recoveryCodes} onContinue={() => navigate({ to: "/" })} />;
  }
  if (challenge.enrollment_required) {
    return (
      <MfaEnrollmentStep
        mfaToken={challenge.mfa_token}
        dueAt={challenge.enrollment_due_at}
        isLoading={mfa.isPending}
        errorMessage={submitError}
        onSubmit={submit}
      />
    );
  }
  return (
    <MfaStep
      mfaToken={challenge.mfa_token}
      factors={challenge.factors ?? []}
      isLoading={mfa.isPending}
      errorMessage={submitError}
      onSubmit={submit}
      onSignedIn={() => navigate({ to: "/" })}
    />
  );
}

/**
 * Renders the second-factor step: a code field (authenticator app, recovery code, or a code sent
 * by email or SMS) and, for the factors this person holds, sending a code, using a passkey, or
 * approving on their phone.
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
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState<"passkey" | "push" | "send" | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const pushAbort = useRef<AbortController | null>(null);
  // Focus the code field from an effect, since the a11y lint rule forbids autoFocus. Unmounting
  // also stops waiting for a push approval.
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    codeRef.current?.focus();
    return () => pushAbort.current?.abort();
  }, []);

  const codeFactors = factors.filter((f) => (f.type === "email" || f.type === "sms") && f.id);
  const hasPasskey = factors.some((f) => f.type === "passkey");
  const hasPush = factors.some((f) => f.type === "push");
  const onlyAuthenticator = factors.every((f) => f.type === "totp" || f.type === "recovery_code");
  const busy = isLoading || pending !== null;
  const shownError = stepError ?? submitError;

  async function run(kind: "passkey" | "push" | "send", fn: () => Promise<void>) {
    setStepError(null);
    setPending(kind);
    try {
      await fn();
    } catch (err) {
      const cancelled = err instanceof Error && err.name === "NotAllowedError";
      if (!cancelled) setStepError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <Card>
        <CardContent className="p-6 md:p-8">
          <form
            aria-busy={busy}
            onSubmit={(e) => {
              e.preventDefault();
              if (busy) return;
              setStepError(null);
              onSubmit({ code: code.trim() });
            }}
          >
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">{t("signIn.mfa.title")}</h1>
                <p className="text-balance text-muted-foreground">
                  {onlyAuthenticator ? t("signIn.mfa.subtitle") : t("signIn.mfa.subtitleAny")}
                </p>
              </div>

              <Field>
                <FieldLabel htmlFor="code">{t("signIn.mfa.codeLabel")}</FieldLabel>
                <Input
                  ref={codeRef}
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                {sentTo && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {t("signIn.mfa.codeSentTo", { destination: sentTo })}
                  </p>
                )}
              </Field>

              {shownError && (
                <Field>
                  <FieldError>{shownError}</FieldError>
                </Field>
              )}

              <Field>
                <Button type="submit" disabled={busy || code.trim().length === 0}>
                  {isLoading && <LoaderCircleIcon className="animate-spin" />}
                  {isLoading ? t("signIn.mfa.verifyingBtn") : t("signIn.mfa.verifyBtn")}
                </Button>
              </Field>

              {(codeFactors.length > 0 || hasPasskey || hasPush) && (
                <Field className="gap-2">
                  <p className="text-center text-xs text-muted-foreground">{t("signIn.mfa.or")}</p>
                  {codeFactors.map((f) => (
                    <Button
                      key={f.id}
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run("send", async () => {
                          await sendMfaCode(mfaToken, f.id as string);
                          setSentTo(f.destination ?? "");
                          codeRef.current?.focus();
                        })
                      }
                    >
                      {t("signIn.mfa.sendCodeTo", { destination: f.destination })}
                    </Button>
                  ))}
                  {hasPasskey && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run("passkey", async () => {
                          onSubmit(await mfaPasskeyProof(mfaToken));
                        })
                      }
                    >
                      {pending === "passkey" && <LoaderCircleIcon className="animate-spin" />}
                      {t("signIn.mfa.usePasskey")}
                    </Button>
                  )}
                  {hasPush && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run("push", async () => {
                          pushAbort.current = new AbortController();
                          if (await completeWithPush(mfaToken, pushAbort.current.signal))
                            onSignedIn();
                        })
                      }
                    >
                      {pending === "push" && <LoaderCircleIcon className="animate-spin" />}
                      {pending === "push" ? t("signIn.mfa.pushWaiting") : t("signIn.mfa.pushBtn")}
                    </Button>
                  )}
                </Field>
              )}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
