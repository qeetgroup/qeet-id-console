import { ArrowRightIcon, DownloadIcon, QrCodeIcon } from "@qeetrix/icons";
import { Button, Checkbox, Field, Heading, Text } from "@qeetrix/react";
import { Alert, CopyButton, Form, OTPInput } from "@qeetrix/react/experimental";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { errorMessage } from "@/platform/errors/user-message";

import { type MfaEnrollment, startMfaEnrollment } from "../api/mfa-sign-in";
import type { MfaProof } from "../api/flows";

const CODE_LENGTH = 6;
const FILE_NAME = "qeet-id-recovery-codes.txt";

// The QR encoder loads only once setup starts.
const EntryQrCode = lazy(() => import("./entry-qr-code").then((m) => ({ default: m.EntryQrCode })));

/** A setup key in groups of four, as authenticator apps print it. */
function groupKey(secret: string): string {
  return secret.replace(/\s+/g, "").replace(/(.{4})(?=.)/g, "$1 ");
}

/**
 * Renders the sign-in step for an account that must have a second factor and holds none: what to
 * do, then the QR code beside its setup key, then a code from the app to complete the sign-in.
 * Until `dueAt`, the end of the organisation's grace period, the setup can be put off.
 */
export function MfaEnrollmentStep({
  mfaToken,
  dueAt,
  isLoading,
  errorMessage: submitError,
  onSubmit,
}: {
  mfaToken: string;
  dueAt?: string;
  isLoading: boolean;
  errorMessage?: string;
  onSubmit: (proof: MfaProof) => void;
}) {
  const { t } = useTranslation("auth-flow");
  const [app, setApp] = useState<MfaEnrollment | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLDivElement>(null);

  // Ready for the code once the app is set up.
  useEffect(() => {
    if (app) codeRef.current?.querySelector("input")?.focus();
  }, [app]);
  // A refused code clears the slots, so the next attempt starts empty.
  useEffect(() => {
    if (submitError) setCode("");
  }, [submitError]);

  async function start() {
    setStartError(null);
    setStarting(true);
    try {
      setApp(await startMfaEnrollment(mfaToken));
    } catch (err) {
      setStartError(errorMessage(err));
    } finally {
      setStarting(false);
    }
  }

  const due = dueAt
    ? new Intl.DateTimeFormat(formatLocale(), { dateStyle: "long" }).format(new Date(dueAt))
    : null;
  const busy = isLoading || starting;
  const skip = due && (
    <Button
      variant="ghost"
      size="lg"
      fullWidth
      disabled={busy}
      onClick={() => onSubmit({ skip: true })}
    >
      {t("signIn.enroll.skipBtn", { date: due })}
    </Button>
  );

  if (!app) {
    return (
      <>
        <div className="entry-heading">
          <Heading level={1} size="display-sm">
            {t("signIn.enroll.title")}
          </Heading>
          <Text tone="subtle" size="lg">
            {due ? t("signIn.enroll.subtitleDue", { date: due }) : t("signIn.enroll.subtitle")}
          </Text>
        </div>
        {(startError ?? submitError) && (
          <Alert tone="danger" title={t("signIn.enroll.startFailedTitle")} announce="urgent">
            {startError ?? submitError}
          </Alert>
        )}
        <ol className="entry-howto">
          <li>
            <strong>{t("signIn.enroll.installTitle")}</strong>
            <span>{t("signIn.enroll.installText")}</span>
          </li>
          <li>
            <strong>{t("signIn.enroll.scanStepTitle")}</strong>
            <span>{t("signIn.enroll.scanStepText")}</span>
          </li>
          <li>
            <strong>{t("signIn.enroll.codeStepTitle")}</strong>
            <span>{t("signIn.enroll.codeStepText")}</span>
          </li>
        </ol>
        <Button
          size="lg"
          fullWidth
          icon={QrCodeIcon}
          loading={starting}
          disabled={busy}
          onClick={() => void start()}
        >
          {t("signIn.enroll.startBtn")}
        </Button>
        {skip}
      </>
    );
  }

  return (
    <>
      <div className="entry-heading">
        <Heading level={1} size="display-sm">
          {t("signIn.enroll.scanTitle")}
        </Heading>
        <Text tone="subtle" size="lg">
          {t("signIn.enroll.scanLede")}
        </Text>
      </div>
      {submitError && (
        <Alert tone="danger" title={t("signIn.mfa.failedTitle")} announce="urgent">
          {submitError}
        </Alert>
      )}
      <div className="entry-qr">
        <Suspense fallback={<div className="entry-qr-placeholder" />}>
          <EntryQrCode value={app.provisioning_url} label={t("signIn.enroll.qrLabel")} />
        </Suspense>
        <div className="entry-qr-key">
          {t("signIn.enroll.keyHint")}
          <code>{groupKey(app.secret)}</code>
          <CopyButton value={app.secret} label={t("signIn.enroll.copyKeyLabel")}>
            {t("signIn.enroll.copyKey")}
          </CopyButton>
        </div>
      </div>
      <Form
        aria-label={t("signIn.enroll.scanTitle")}
        className="entry-form"
        summary={false}
        aria-busy={busy}
        onFormSubmit={() => {
          if (busy || code.length < CODE_LENGTH) return;
          onSubmit({ code });
        }}
      >
        <div ref={codeRef}>
          <Field label={t("signIn.enroll.codeLabel")} name="code" invalid={Boolean(submitError)}>
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
          disabled={busy || code.length < CODE_LENGTH}
        >
          {isLoading ? t("signIn.mfa.verifyingBtn") : t("signIn.enroll.confirmBtn")}
        </Button>
      </Form>
      {skip}
    </>
  );
}

/**
 * Renders the recovery codes minted when a sign-in set up an authenticator app, shown once: copy
 * or download them, and say they're saved before going on into the console.
 */
export function RecoveryCodesStep({
  codes,
  onContinue,
}: {
  codes: string[];
  onContinue: () => void;
}) {
  const { t } = useTranslation("auth-flow");
  const [saved, setSaved] = useState(false);

  function download() {
    const url = URL.createObjectURL(new Blob([`${codes.join("\n")}\n`], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = FILE_NAME;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="entry-heading">
        <Heading level={1} size="display-sm">
          {t("signIn.enroll.codesTitle")}
        </Heading>
        <Text tone="subtle" size="lg">
          {t("signIn.enroll.codesSubtitle")}
        </Text>
      </div>
      <div className="entry-codes">
        <div className="entry-codes-head">
          {t("signIn.enroll.codesCount", { count: codes.length })}
          <div>
            <CopyButton size="sm" value={codes.join("\n")} label={t("signIn.enroll.copyAllLabel")}>
              {t("signIn.enroll.copyAll")}
            </CopyButton>
            <Button variant="ghost" tone="neutral" size="sm" icon={DownloadIcon} onClick={download}>
              {t("signIn.enroll.downloadBtn")}
            </Button>
          </div>
        </div>
        <ol>
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ol>
      </div>
      <Checkbox
        label={t("signIn.enroll.savedCheck")}
        checked={saved}
        onCheckedChange={(checked) => setSaved(checked === true)}
      />
      <Button size="lg" fullWidth icon={ArrowRightIcon} disabled={!saved} onClick={onContinue}>
        {t("signIn.enroll.continueBtn")}
      </Button>
    </>
  );
}
