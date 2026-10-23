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
                <h1 className="text-2xl font-bold">Verify your email</h1>
                <p className="text-balance text-muted-foreground">
                  We sent a 6-digit code to <span className="font-medium">{email}</span>. Enter it
                  below to finish creating your account.
                </p>
              </div>

              <Field>
                <FieldLabel htmlFor="code">Verification code</FieldLabel>
                <Input
                  ref={codeRef}
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
                <FieldDescription>The code expires in 10 minutes.</FieldDescription>
              </Field>

              {errorMessage && (
                <Field>
                  <FieldError>{errorMessage}</FieldError>
                </Field>
              )}

              <Field>
                <Button type="submit" disabled={isLoading || code.trim().length < 6}>
                  {isLoading && <LoaderCircleIcon className="animate-spin" />}
                  {isLoading ? "Verifying…" : "Verify email"}
                </Button>
              </Field>

              <FieldDescription className="text-center">
                Didn&apos;t get it?{" "}
                <button
                  type="button"
                  className="underline underline-offset-4 disabled:opacity-50"
                  onClick={onResend}
                  disabled={isResending}
                >
                  {isResending ? "Resending…" : "Resend code"}
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
