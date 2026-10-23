import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CopyableSecret,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  OTPInput,
  QRCode,
} from "@qeetrix/ui";
import { LoaderCircleIcon } from "@qeetrix/icons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ErrorText } from "@/platform/components/error-reference";
import type { TotpEnrollment } from "../api/mfa";

const CODE_LENGTH = 6;

/**
 * Renders the app being set up: its QR code, URI and secret, and the code that confirms it.
 * Nothing secret leaves the browser beyond the provisioning URL the server returned.
 */
export function TotpEnrollmentCard({
  enrollment,
  error,
  isConfirming,
  onConfirm,
  onCancel,
}: {
  enrollment: TotpEnrollment;
  error: unknown;
  isConfirming: boolean;
  onConfirm: (code: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("auth");
  const [code, setCode] = useState("");

  // Focuses the code input once the card animation settles, in place of autoFocus.
  const otpWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      otpWrapperRef.current?.querySelector<HTMLInputElement>("input:not([disabled])")?.focus();
    }, 50);
    return () => clearTimeout(id);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("mfa.totp.enrolling.title")}</CardTitle>
        <CardDescription>{t("mfa.totp.enrolling.subtitle")}</CardDescription>
        {enrollment.replacing && (
          <p className="text-sm text-muted-foreground">{t("mfa.totp.enrolling.replacingNote")}</p>
        )}
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel id="totp-scan">{t("mfa.totp.enrolling.scanLabel")}</FieldLabel>
            <div className="flex flex-col items-center gap-4 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:justify-center">
              <div className="shrink-0 rounded-lg border bg-white p-3">
                <QRCode
                  value={enrollment.provisioning_url}
                  size={168}
                  aria-labelledby="totp-scan"
                  aria-describedby="totp-scan-hint"
                />
              </div>
              <p id="totp-scan-hint" className="max-w-xs text-sm text-muted-foreground">
                {t("mfa.totp.enrolling.scanHint")}
              </p>
            </div>
          </Field>
          <Field>
            <FieldLabel>{t("mfa.totp.enrolling.uriLabel")}</FieldLabel>
            <CopyableSecret value={enrollment.provisioning_url} size="sm" />
            <FieldDescription>{t("mfa.totp.enrolling.uriHelp")}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>{t("mfa.totp.enrolling.secretLabel")}</FieldLabel>
            <CopyableSecret value={enrollment.secret} size="sm" />
            <FieldDescription>{t("mfa.totp.enrolling.secretHelp")}</FieldDescription>
          </Field>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === CODE_LENGTH) onConfirm(code);
            }}
            className="contents"
          >
            <Field>
              <FieldLabel>{t("mfa.totp.enrolling.codeLabel")}</FieldLabel>
              <div ref={otpWrapperRef}>
                <OTPInput
                  value={code}
                  onChange={setCode}
                  onComplete={onConfirm}
                  aria-label={t("mfa.totp.enrolling.codeAriaLabel")}
                  aria-invalid={!!error}
                />
              </div>
              <FieldDescription>{t("mfa.totp.enrolling.codeHelp")}</FieldDescription>
            </Field>
            {error != null && (
              <FieldError>
                <ErrorText error={error} />
              </FieldError>
            )}
            <Field className="flex flex-row justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                {t("mfa.totp.enrolling.cancelBtn")}
              </Button>
              <Button type="submit" disabled={isConfirming || code.length !== CODE_LENGTH}>
                {isConfirming && <LoaderCircleIcon className="animate-spin" />}
                {isConfirming
                  ? t("mfa.totp.enrolling.verifyingBtn")
                  : t("mfa.totp.enrolling.confirmBtn")}
              </Button>
            </Field>
          </form>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
