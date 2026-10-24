import {
  Button,
  Card,
  CardContent,
  CopyableSecret,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from "@qeetrix/ui";
import { LoaderCircleIcon } from "@qeetrix/icons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { errorMessage } from "@/platform/errors/user-message";

import { type MfaEnrollment, startMfaEnrollment } from "../api/mfa-sign-in";
import type { MfaProof } from "../api/flows";
import { LazyQRCode } from "./lazy-qr-code";
import { RecoveryCodeList } from "./recovery-code-list";

/**
 * Renders the sign-in step for an account that must have a second factor and holds none: set up
 * an authenticator app, then confirm it with a code to complete the sign-in. Until `dueAt`, the
 * end of the organisation's grace period, the setup can be put off.
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
  const codeRef = useRef<HTMLInputElement>(null);

  // Ready for the code once the app is set up.
  useEffect(() => {
    if (app) codeRef.current?.focus();
  }, [app]);

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
  const shownError = startError ?? submitError;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <Card>
        <CardContent className="p-6 md:p-8">
          <form
            aria-busy={busy}
            onSubmit={(e) => {
              e.preventDefault();
              if (busy || !app) return;
              onSubmit({ code: code.trim() });
            }}
          >
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">{t("signIn.enroll.title")}</h1>
                <p className="text-balance text-muted-foreground">
                  {due
                    ? t("signIn.enroll.subtitleDue", { date: due })
                    : t("signIn.enroll.subtitle")}
                </p>
              </div>

              {app ? (
                <>
                  <Field>
                    <FieldLabel id="enroll-scan">{t("signIn.enroll.scanLabel")}</FieldLabel>
                    <div className="flex justify-center">
                      <LazyQRCode
                        value={app.provisioning_url}
                        size={200}
                        aria-labelledby="enroll-scan"
                        aria-describedby="enroll-key"
                      />
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel>{t("signIn.enroll.keyLabel")}</FieldLabel>
                    <div id="enroll-key">
                      <CopyableSecret value={app.secret} size="sm" />
                    </div>
                    <FieldDescription>{t("signIn.enroll.keyHint")}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="enroll-code">{t("signIn.enroll.codeLabel")}</FieldLabel>
                    <Input
                      ref={codeRef}
                      id="enroll-code"
                      name="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </Field>
                </>
              ) : (
                <Field>
                  <Button type="button" disabled={busy} onClick={start}>
                    {starting && <LoaderCircleIcon className="animate-spin" />}
                    {t("signIn.enroll.startBtn")}
                  </Button>
                </Field>
              )}

              {shownError && (
                <Field>
                  <FieldError>{shownError}</FieldError>
                </Field>
              )}

              {app && (
                <Field>
                  <Button type="submit" disabled={busy || code.trim().length === 0}>
                    {isLoading && <LoaderCircleIcon className="animate-spin" />}
                    {isLoading ? t("signIn.mfa.verifyingBtn") : t("signIn.enroll.confirmBtn")}
                  </Button>
                </Field>
              )}

              {due && (
                <Field>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onSubmit({ skip: true })}
                  >
                    {t("signIn.enroll.skipBtn")}
                  </Button>
                </Field>
              )}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Renders the recovery codes minted when a sign-in set up an authenticator app, shown once before
 * the person continues into the console.
 */
export function RecoveryCodesStep({
  codes,
  onContinue,
}: {
  codes: string[];
  onContinue: () => void;
}) {
  const { t } = useTranslation("auth-flow");

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <Card>
        <CardContent className="p-6 md:p-8">
          <FieldGroup>
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-2xl font-bold">{t("signIn.enroll.codesTitle")}</h1>
              <p className="text-balance text-muted-foreground">
                {t("signIn.enroll.codesSubtitle")}
              </p>
            </div>
            <RecoveryCodeList
              codes={codes}
              copyLabel={t("signIn.enroll.copyBtn")}
              copiedLabel={t("signIn.enroll.copiedBtn")}
              downloadLabel={t("signIn.enroll.downloadBtn")}
            />
            <Field>
              <Button type="button" onClick={onContinue}>
                {t("signIn.enroll.continueBtn")}
              </Button>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}
