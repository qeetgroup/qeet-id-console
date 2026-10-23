import {
  Button,
  Card,
  CardContent,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from "@qeetrix/ui";
import { LoaderCircleIcon } from "@qeetrix/icons";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

/**
 * Renders the sign-up email code step. The standalone `/verify-email` route holds an unverified
 * account here until the code is confirmed, so a page refresh can't skip verification.
 */
export function VerifyEmailStep({
  email,
  isLoading,
  isResending,
  errorMessage,
  onResend,
  onSubmit,
  footer,
}: {
  email: string;
  isLoading: boolean;
  isResending: boolean;
  errorMessage?: string;
  onResend: () => void;
  onSubmit: (code: string) => void;
  footer?: React.ReactNode;
}) {
  const { t } = useTranslation("auth-flow");
  const [code, setCode] = useState("");
  // Focus the code field from an effect, since the a11y lint rule forbids autoFocus.
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <Card>
        <CardContent className="p-6 md:p-8">
          <form
            aria-busy={isLoading}
            onSubmit={(e) => {
              e.preventDefault();
              if (isLoading) return;
              onSubmit(code.trim());
            }}
          >
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">{t("verifyEmail.title")}</h1>
                <p className="text-balance text-muted-foreground">
                  <Trans
                    t={t}
                    i18nKey="verifyEmail.sentTo"
                    values={{ email }}
                    components={{ email: <span className="font-medium" /> }}
                  />
                </p>
              </div>

              <Field>
                <FieldLabel htmlFor="code">{t("verifyEmail.codeLabel")}</FieldLabel>
                <Input
                  ref={codeRef}
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  // No maxLength: it would cut a code pasted with spaces around it before the
                  // digits are taken, leaving too few to submit.
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <FieldDescription>{t("verifyEmail.expiry")}</FieldDescription>
              </Field>

              {errorMessage && (
                <Field>
                  <FieldError>{errorMessage}</FieldError>
                </Field>
              )}

              <Field>
                <Button type="submit" disabled={isLoading || code.trim().length < 6}>
                  {isLoading && <LoaderCircleIcon className="animate-spin" />}
                  {isLoading ? t("verifyEmail.submitting") : t("verifyEmail.submit")}
                </Button>
              </Field>

              <FieldDescription className="text-center">
                {t("verifyEmail.noCode")}{" "}
                <button
                  type="button"
                  className="underline underline-offset-4 disabled:opacity-50"
                  onClick={onResend}
                  disabled={isResending}
                >
                  {isResending ? t("verifyEmail.resending") : t("verifyEmail.resend")}
                </button>
              </FieldDescription>

              {footer}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
