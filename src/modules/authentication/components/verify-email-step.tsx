import { ArrowRightIcon } from "@qeetrix/icons";
import { Button, Field, Heading, Text } from "@qeetrix/react";
import { Alert, Form, OTPInput } from "@qeetrix/react/experimental";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { EntryInboxLinks } from "./entry-shell";

const CODE_LENGTH = 6;
// A resend waits this long, so nobody floods their own inbox (the server throttles too).
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Renders the sign-up email code step. The standalone `/verify-email` route holds an unverified
 * account here until the code is confirmed, so a page refresh can't skip verification.
 */
export function VerifyEmailStep({
  email,
  isLoading,
  isResending,
  resent = false,
  errorMessage,
  onResend,
  onSubmit,
  footer,
}: {
  email: string;
  isLoading: boolean;
  isResending: boolean;
  /** A new code went out from this page. */
  resent?: boolean;
  errorMessage?: string;
  onResend: () => void;
  onSubmit: (code: string) => void;
  footer?: ReactNode;
}) {
  const { t } = useTranslation("auth-flow");
  const [code, setCode] = useState("");

  // A refused code clears the slots, so the next attempt starts empty.
  useEffect(() => {
    if (errorMessage) setCode("");
  }, [errorMessage]);

  // Focus the first slot from an effect, since the a11y lint rule forbids autoFocus.
  const slotsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    slotsRef.current?.querySelector("input")?.focus();
  }, []);

  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  return (
    <>
      <div className="entry-heading">
        <Heading level={1} size="display-sm">
          {t("verifyEmail.title")}
        </Heading>
        <Text tone="subtle" size="lg">
          <Trans
            t={t}
            i18nKey="verifyEmail.sentTo"
            values={{ email }}
            components={{ email: <b className="entry-strong" /> }}
          />
        </Text>
      </div>

      {errorMessage ? (
        <Alert tone="danger" title={t("verifyEmail.wrongTitle")} announce="urgent">
          {errorMessage}
        </Alert>
      ) : resent ? (
        <Alert tone="success" title={t("verifyEmail.resentTitle")} announce="polite">
          {t("verifyEmail.resentText")}
        </Alert>
      ) : null}

      <Form
        aria-label={t("verifyEmail.title")}
        className="entry-form"
        summary={false}
        aria-busy={isLoading}
        onFormSubmit={() => {
          if (isLoading || code.length < CODE_LENGTH) return;
          onSubmit(code);
        }}
      >
        <div ref={slotsRef}>
          <Field
            label={t("verifyEmail.codeLabel")}
            name="code"
            description={t("verifyEmail.expiry")}
            invalid={Boolean(errorMessage)}
          >
            <OTPInput
              length={CODE_LENGTH}
              groups={[3, 3]}
              size="lg"
              autoComplete="one-time-code"
              value={code}
              onValueChange={setCode}
            />
          </Field>
        </div>
        <Button
          type="submit"
          size="lg"
          fullWidth
          icon={ArrowRightIcon}
          loading={isLoading}
          disabled={isLoading || code.length < CODE_LENGTH}
        >
          {isLoading ? t("verifyEmail.submitting") : t("verifyEmail.submit")}
        </Button>
      </Form>

      <EntryInboxLinks />

      <div className="entry-links">
        {cooldown > 0 ? (
          <span>
            {t("verifyEmail.noCode")}{" "}
            <Trans
              t={t}
              i18nKey="verifyEmail.resendIn"
              values={{ time: `0:${String(cooldown).padStart(2, "0")}` }}
              components={{ time: <span className="entry-num" /> }}
            />
          </span>
        ) : (
          <span>
            {t("verifyEmail.noCode")}{" "}
            <button
              type="button"
              className="entry-text-button"
              disabled={isResending}
              onClick={() => {
                setCooldown(RESEND_COOLDOWN_SECONDS);
                onResend();
              }}
            >
              {isResending ? t("verifyEmail.resending") : t("verifyEmail.resend")}
            </button>
          </span>
        )}
        {footer}
      </div>
    </>
  );
}
