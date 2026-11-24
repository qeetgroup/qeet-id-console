import { RotateCwIcon } from "@qeetrix/icons";
import { Button, Heading, Spinner, Text, VisuallyHidden } from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "@/platform/errors/user-message";

import {
  awaitPushApproval,
  type PushRequest,
  pushRequestOutcome,
  sendPushRequest,
} from "../api/mfa-sign-in";

type PushState = "sending" | "waiting" | "approved" | "denied" | "ended" | "failed";

/** Returns seconds as m:ss. */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Renders the second step on the phone: a request goes to Qeet ID on the linked phone and the
 * step shows the two-digit number to type there, so a request someone else started can't be
 * approved by a tap. It waits for the phone's answer and signs in once approved; a denied or
 * unanswered request says so and offers a new one.
 */
export function ApproveOnPhoneStep({
  mfaToken,
  onSignedIn,
  onAnother,
}: {
  mfaToken: string;
  onSignedIn: () => void;
  onAnother: () => void;
}) {
  const { t } = useTranslation("auth-flow");
  const [state, setState] = useState<PushState>("sending");
  const [request, setRequest] = useState<PushRequest | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [now, setNow] = useState(() => Date.now());
  const run = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const start = useCallback(async () => {
    run.current?.abort();
    const mine = new AbortController();
    run.current = mine;
    setState("sending");
    setRequest(null);
    setError(null);
    // The step replaces what was clicked, so focus moves to its heading.
    heading.current?.focus();
    try {
      const sent = await sendPushRequest(mfaToken);
      if (mine.signal.aborted) return;
      setRequest(sent);
      setState("waiting");
      if (!(await awaitPushApproval(mfaToken, mine.signal))) return;
      // Approved: the session is set even if the person has since turned away.
      setState("approved");
      onSignedIn();
    } catch (err) {
      if (mine.signal.aborted) return;
      setError(err);
      setState(pushRequestOutcome(err));
    }
  }, [mfaToken, onSignedIn]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: one request when the step opens
  useEffect(() => {
    void start();
    return () => run.current?.abort();
  }, []);

  const waiting = state === "waiting";
  useEffect(() => {
    if (!waiting) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waiting]);

  const pending = state === "sending" || waiting;
  const ended = state === "denied" || state === "ended" || state === "failed";
  const secondsLeft = request ? Math.round((Date.parse(request.expires_at) - now) / 1000) : NaN;
  const title =
    state === "approved"
      ? t("signIn.mfa.push.approvedTitle")
      : state === "denied"
        ? t("signIn.mfa.push.deniedTitle")
        : state === "ended"
          ? t("signIn.mfa.push.endedTitle")
          : t("signIn.mfa.push.title");
  const body =
    state === "approved"
      ? t("signIn.mfa.push.approvedBody")
      : state === "denied"
        ? t("signIn.mfa.push.deniedBody")
        : state === "ended"
          ? t("signIn.mfa.push.endedBody")
          : pending
            ? t("signIn.mfa.push.body")
            : null;
  // Announced once per change; the time left counts down on screen only.
  const announcement =
    state === "sending"
      ? t("signIn.mfa.push.sending")
      : waiting && request
        ? t("signIn.mfa.push.numberLabel", { number: request.number })
        : state === "approved"
          ? t("signIn.mfa.push.continuing")
          : state === "failed"
            ? ""
            : title;

  return (
    <>
      <div className="entry-heading">
        <Heading level={1} size="display-sm" ref={heading} tabIndex={-1}>
          {title}
        </Heading>
        {body && (
          <Text tone="subtle" size="lg">
            {body}
          </Text>
        )}
      </div>
      <VisuallyHidden role="status">{announcement}</VisuallyHidden>

      {state === "failed" && (
        <Alert tone="danger" title={t("signIn.mfa.stepFailedTitle")} announce="urgent">
          {errorMessage(error)}
        </Alert>
      )}

      {waiting && request && (
        <div
          className="entry-push-number"
          role="img"
          aria-label={t("signIn.mfa.push.numberLabel", { number: request.number })}
        >
          <span aria-hidden="true">{t("signIn.mfa.push.number")}</span>
          <span aria-hidden="true" className="entry-push-number-value">
            {request.number}
          </span>
        </div>
      )}

      {(pending || state === "approved") && (
        <div className="entry-status" aria-hidden="true">
          <Spinner size="sm" tone="brand" decorative />
          <Text tone="subtle">
            {state === "sending"
              ? t("signIn.mfa.push.sending")
              : state === "approved"
                ? t("signIn.mfa.push.continuing")
                : secondsLeft > 0
                  ? t("signIn.mfa.push.waiting", { time: clock(secondsLeft) })
                  : t("signIn.mfa.push.waitingNoTime")}
          </Text>
        </div>
      )}

      {state !== "approved" && (
        <div className="entry-form">
          {ended && (
            <Button size="lg" fullWidth icon={RotateCwIcon} onClick={() => void start()}>
              {t("signIn.mfa.push.resend")}
            </Button>
          )}
          <Button variant="ghost" size="lg" fullWidth onClick={onAnother}>
            {t("signIn.mfa.push.another")}
          </Button>
        </div>
      )}
    </>
  );
}
